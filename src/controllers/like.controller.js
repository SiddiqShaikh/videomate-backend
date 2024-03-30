import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { Like } from "../models/like.model";
import { ApiResponse } from "../utils/ApiResponse";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  const likedAlready = await Like.findOne({
    likedBy: req?.user?._id,
    video: videoId,
  });
  if (likedAlready) {
    await Like.findByIdAndDelete(likedAlready?._id);
    return res.status(200).json(new ApiResponse(200, { isLiked: false }));
  }
  await Like.create({
    likedBy: req?.user?._id,
    video: videoId,
  });
  return res.status(200).json(new ApiResponse(200, { isLiked: true }));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }
  const likedAlready = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user._id,
  });
  if (likedAlready) {
    await Like.findByIdAndDelete(likedAlready._id);
    return res.status(200).json(new ApiResponse(200, { isLiked: false }));
  }
  await Like.create({
    likedBy: req.user._id,
    tweet: tweetId,
  });
  return res.status(200).json(200, { isLiked: true });
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment Id");
  }
  const likedAlready = await Like.findOne({
    comment: commentId,
    likedBy: req.user._id,
  });

  if (likedAlready) {
    await Like.findByIdAndDelete(likedAlready._id);
    return res.status(200).json(new ApiError(200, { isLiked: false }));
  }
  await Like.create({
    comment: commentId,
    likedBy: req.user._id,
  });
  return res.status(200).json(new ApiResponse(200, { isLiked: true }));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const LikedVideosAggregate = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        foreignField: "_id",
        localField: "video",
        as: "likedVideos",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "ownerDetails",
            },
          },
          {
            $unwind: "$ownerDetails",
          },
        ],
      },
    },
    {
      $unwind: "$likedVideos",
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
        $project:{
            _id:0,
            likedVideo:{
                _id:1,
                "videoFile.url":1,
                "thumbnail.url":1,
                owner: 1
            }
        }
    }
  ]);
});

export { toggleVideoLike, toggleTweetLike, toggleCommentLike, getLikedVideos };
