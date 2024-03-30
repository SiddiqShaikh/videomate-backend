import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";

const uploadVideo = asyncHandler(async (req, res) => {
  // check data from body
  // check files from multer (thumbnail, video)
  // upload on cloudinary
  // save db -- user._id
  // send res

  const { title, description } = req.body;
  if ([title, description].some((field) => field.trim() === "")) {
    throw new ApiError(400, "All Fields are required!");
  }
  const localThumbnailImage = req.files?.thumbnail[0].path;
  const localVideo = req.files?.videoFile[0].path;
  if (!localThumbnailImage) {
    throw new ApiError(400, "Thumbnail is required!");
  }
  const thumbnailUpload = await uploadOnCloudinary(localThumbnailImage);
  if (!thumbnailUpload) {
    throw new ApiError(400, "Cloudinary Error: Thumbnail is required!");
  }
  if (!localVideo) {
    throw new ApiError(400, "Thumbnail is required!");
  }

  const videolUpload = await uploadOnCloudinary(localVideo);
  if (!videolUpload) {
    throw new ApiError(400, "Cloudinary Error: video is required!");
  }
  const video = await Video.create({
    title,
    description,
    videoFile: { url: videolUpload?.url, public_id: videolUpload?.public_id },
    thumbnail: {
      url: thumbnailUpload?.url,
      public_id: thumbnailUpload?.public_id,
    },
    duration: videolUpload?.duration,
    isPublished: true,
    owner: req?.user?._id,
  });
  const videoCreated = await Video.findById(video._id);
  if (!videoCreated) {
    throw new ApiError(500, "Something went wrong while uploading a video!");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, videoCreated, "Video uploaded successfully!"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const { videoId } = req.params;
  if (!(title && description)) {
    throw new ApiError(400, "title or description is missing!");
  }
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id!");
  }
  const video = await Video.findById(videoId);
  console.log(video.owner.toString(),"===",req.user?._id);
  if (!video) {
    throw new ApiError(404, "Video Not Found!");
  }
  if (video.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(401, "Unauthorized to edit this video!");
  }

  const localThumbnailImage = req.file?.path;
  if (!localThumbnailImage) {
    throw new ApiError(400, "Thumbnail is missing");
  }
  const thumbnailUpload = await uploadOnCloudinary(localThumbnailImage);
  if (!thumbnailUpload) {
    throw new ApiError(400, "Thumbnail is missing");
  }
  const dbThumbnail = video.thumbnail.public_id;
  await deleteOnCloudinary(dbThumbnail);
  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: {
          url: thumbnailUpload?.url,
          public_id: thumbnailUpload?.public_id,
        },
      },
    },
    { new: true }
  );
  if (!updateVideo) {
    throw new ApiError(500, "Something went wrong while updating video!");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video Updated Successfully!"));
});

const getVideos = asyncHandler(async (req, res) => {
  // sorting, filters, pagination
  //   req query ---> sort type(asc, desc) sorty by (views,duration,createdAt), userId, page, limit, query (on title and description)
  // pipeline
  // if query --> $search---> indexname,{text:{query, path[]}}
  // if userId ---> $match:{owner : userId}
  // $match: ifPublished:true
  // if sortyBy && sortType --> $sort:{[sortBy]: sortType} by default created At -1
  // join owner to user show only name and avatar
  const { page = 1, limit = 10, sortType, sortBy, query, userId } = req.query;

  const pipeline = [];
  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"],
        },
      },
    });
  }
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid Channel Id");
    }
    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }
  pipeline.push({
    $match: {
      isPublished: true,
    },
  });
  if (sortBy && sortType) {
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

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "channelDetails",
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
    { $unwind: "$channelDetails" }
  );
  const videoAggregate = Video.aggregate(pipeline);
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  const videos = await Video.aggregatePaginate(videoAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos Fetched Successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  // params videoId check
  // aggregate --> match video id
  // join owner --> name, subscriber, is subscribed or not.
  // res send

  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video Id");
  }
  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "Owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscriberCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [req.user?._id, "$subscribers.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              avatar: 1,
              subscriberCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        "videoFile.url": 1,
        'thumbnail.url': 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        owner: 1,
      },
    },
  ]);
  if (!video) {
    throw new ApiError(500, "Failed to fetched video!!");
  }
  //when fetched successfully increment in views
  await Video.findByIdAndUpdate(videoId, {
    $inc: {
      views: 1,
    },
  });
  //when fetched successfully add to watch history of requested user.

  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchHistory: videoId,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video Fetched Successfully!"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  //check video Id from param
  // owner validation. verify through jwt
  // delete video from cloudinary too -- publicId
  // find and delete
  // delete comments
  // delete likes
  // send res

  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "Video cannot found!");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(401, "Unauthorized Error: owner access required!");
  }
  const deletedVideo = await Video.findByIdAndDelete(videoId);

  if (!deleteVideo) {
    throw new ApiError(400, "Failed to delete Video");
  }
  await deleteOnCloudinary(video?.thumbnail.public_id);
  await deleteOnCloudinary(video?.videoFile.public_id, "video");

  // await deleteMany from comments where video Id exists
  // await deleteMany from likes where video Id exists
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  // check and find VideoId
  // check owner
  // find and update by Id --> videoId, $set
});

export { uploadVideo, updateVideo, getVideos, getVideoById, deleteVideo };

// uploadVideo,
//     updateVideo,
//     getAllVideos,
//     getVideoById,
//     togglePublishStatus,
//     deleteVideo,
