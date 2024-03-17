import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessTokenAndRefreshToken = async (userID) => {
  try {
    const user = await User.findById(userID);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating token!!");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res
  const { username, fullname, email, password } = req.body;
  if (
    [username, fullname, email, password].some(
      (fields) => fields?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All Fields are required");
  }
  const existedUser = await User.findOne({
    $or: [{ username, email }],
  });
  if (existedUser) {
    throw new ApiError(409, "Username or email already exists");
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new Error("Profile Image is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  //   const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Profile Image is required");
  }

  const user = await User.create({
    email,
    fullname,
    password,
    avatar: avatar?.url,
    // coverImage: coverImage?.url || "",
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(400, "Something went Wrong while creating new user");
  }

 return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created Successfully!"));
});

const loginUser = asyncHandler(async (req, res) => {
  // extract body in req
  // check if fields are empty
  // find user
  // check password
  // accessToken and refresh token
  // send cookie res
  const { username, email, password } = req.body;

  if (!email && !username) {
    throw new ApiError(400, "User name and email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(409, "user not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid Credentials");
  }
  //   console.log("user ==>",user)
  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, refreshToken, accessToken },
        "Logged in Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refeshToken: 1 },
    },
    { new: true }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  //check refresh token incoming from cookies/body
  const incomingRefreshToken =
    req?.cookies?.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }
  //decode refresh token
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    //find user
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    //check incoming R-token and user-R-Token
    if (incomingRefreshToken !== user?.refeshToken) {
      throw new ApiError(401, "Refresh Token is expired");
    }

    // generate token
    const { accessToken, newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);
    //send res and set cookies
    const options = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .cookies("accessToken", accessToken, options)
      .cookies("refreshToken", newRefreshToken, options)
      .send(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  //find user
  const user = await User.findById(req.user._id);

  //check current password
  const isPasswordCorrect = user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid current password");
  }
  //update password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  // send res
  return res
    .status(200)
    .json(new ApiResponse(200, "Password Changed successfully!"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User Fetched Successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  //check body
  const { fullname, email } = req.body;
  if (!fullname || !email) {
    throw new ApiError(400, "All fields are reqiured!");
  }

  //find user and update set new
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { fullname, email } },
    { new: true }
  ).select("-password");
  // send res
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated Successfully"));
});

const updateProfileImage = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar on cloudinary");
  }
  
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Profile Image Updated Successfully"));
});

const UpdateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image is missing");
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage) {
    throw new ApiError(400, "Error while Uploading cover image on cloudinary");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image Updated Successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  // params--> username
  //aggregation match for username
  // left join for subscribers (_id,subscriber)
  // left join for subscribedto (_id,channel)
  //add field , count by size, issubscribed check throgh req.user.id in subscribers
  // now project
  //send res and aggregate returns array we have only one element send 0th index

  const { username } = req.params;
  if (!username.trim()) {
    throw new ApiError(400, "Username missing!!");
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "suscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subsriberCount: {
          $size: "$suscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribe: {
          $cond: {
            if: { $in: [req.user?._id, "$suscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        email: 1,
        subsriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribe: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ]);
  if (!channel.length) {
    throw new ApiError(400, "Channel doesnot exist!");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel Fetched Successfully!"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    { $match: mongoose.Schema.Types.ObjectId(req.user._id) },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched Successfully"
      )
    );
});
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateProfileImage,
  UpdateCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};

