import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Tweet } from "../models/tweet.model.js";
import { Like } from "../models/like.model.js";
import mongoose, { isValidObjectId } from "mongoose";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, "Tweet is required!");
  }
  const createdTweet = await Tweet.create({
    content,
    owner: req.user?._id,
  });
  if (!createdTweet) {
    throw new ApiError(500, "Something went wrong while tweet!");
  }
  return res
    .status(201)
    .json(new ApiResponse(201, createdTweet, "Tweet Successfully Created!"));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;
  console.log(content, "req=====", req.body.content);
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid Tweet Id");
  }
  if (!content) {
    throw new ApiError(400, "Tweet is Required");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet not found!");
  }

  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(401, "Unauthorized to update this tweet!");
  }
  const updateTweet = await Tweet.findByIdAndUpdate(
    tweet._id,
    {
      $set: {
        content,
      },
    },
    {
      new: true,
    }
  );
  if (!updateTweet) {
    throw new ApiError(500, "Something went wrong while updating tweet!");
  }
  return res
    .status(201)
    .json(new ApiResponse(201, updateTweet, "Tweet Updated successfully!"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  // check tweet id in params
  // find and delete tweet
  // delete all likes of comment
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid Tweet Id");
  }
  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet Not Found!");
  }
  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(401, "Unauthorized request!");
  }
  const deletedTweet = await Tweet.findByIdAndDelete(tweet._id);
  if (!deletedTweet) {
    throw new ApiError(500, "Something went wrong while deleting tweet!");
  }
  await Like.deleteMany({ tweet: tweet._id });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Tweet deleted successfully!"));
});

const getAllTweets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sortType, sortBy } = req.query;
  let pipeline = [];
  pipeline.push(
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: { path: "$owner", preserveNullAndEmptyArrays: true },
    },
    {
      $addFields: {
        owner: "$owner",
      },
    }
  );
  if (sortType && sortBy) {
    pipeline.push({
      $sort: {
        [sortType]: sortBy === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({
      $sort: {
        createdAt: -1,
      },
    });
  }

  // const tweetAggregate = await Tweet.aggregate([
  //   {
  //     $lookup: {
  //       from: "users",
  //       foreignField: "_id",
  //       localField: "owner",
  //       as: "Owner",
  //       pipeline:[
  //         {
  //           $project:{
  //             username:1,
  //             _id:1,
  //             avatar:1,
  //             email:1,

  //           }
  //         }
  //       ]
  //     },
  //   },
  //   {
  //     $unwind: "$Owner",
  //   },
  // ]);
  const tweetAggregate = Tweet.aggregate(pipeline);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  const tweet = await Tweet.aggregatePaginate(tweetAggregate, options);
  if (!tweet) {
    throw new ApiError(500, "Internal Server Error");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweet Fetched Successfully!"));
});

const getTweetsByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid User Id");
  }
  let pipeline = [];
  pipeline.push({
    $match: {
      owner: new mongoose.Types.ObjectId(userId),
    },
  });
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              avatar: 1,
              username: 1,
              email: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        owner: "$owner",
      },
    }
  );
  const tweetAggregate = Tweet.aggregate(pipeline);
  const options = {
    page: parseInt(page, 10),
    imit: parseInt(limit, 10),
  };
  const tweet = await Tweet.aggregatePaginate(tweetAggregate, options);
  if (!tweet) {
    throw new ApiError(500, "Internal Server Error");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweets Fetched Successfully!"));
});

export {
  getAllTweets,
  createTweet,
  updateTweet,
  deleteTweet,
  getTweetsByUserId,
};
