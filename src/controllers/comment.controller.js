import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { ApiResponse } from "../utils/ApiResponse";

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  if (!content) {
    throw new ApiError(400, "Comment is required");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found!");
  }
  const commentCreated = await Comment.create({
    content,
    video: videoId,
    owner: req.user?._id,
  });
  if (!commentCreated) {
    throw new ApiError(500, "Something Went wrong!!");
  }
  return res
    .status(201)
    .json(new ApiResponse(201, commentCreated, "Comment added successfully"));
});

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  const commentAgrregate = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "owner",
      },
    },
    {
      $lookup: {
        from: "likes",
        foreignField: "_id",
        localField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user._id, "likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        likesCount: 1,
        owner: {
          username: 1,
          fullname: 1,
          "avatar.url": 1,
        },
        isLiked: 1,
      },
    },
  ]);
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  const comments = await Comment.aggregatePaginate(commentAgrregate, options);
  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments Fetched Successfully!"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid Comment Id");
  }
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  if (!content) {
    throw new ApiError(400, "comment field is required");
  }
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(401, "You are not authorized to edit this comment!");
  }
  const updatedComment = await Comment.findByIdAndUpdate(
    comment._id,
    {
      $set: {
        content,
      },
    },
    {
      new: true,
    }
  );
  if (!updatedComment) {
    throw new ApiError(500, "Something went wrong while Updating comment!");
  }
  return res
    .status(201)
    .json(
      new ApiResponse(201, updatedComment, "Comment Updated Successfully!")
    );
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid Comment Id");
  }
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found!");
  }
  if (comment.owner.toString() !== req.user?._id) {
    throw new ApiError(401, "Unauthorized to delete this comment!");
  }
  await Comment.findByIdAndDelete(commentId);
  await Like.deleteMany({
    comment: commentId,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment Deleted Successfully!"));
});

export { addComment, getVideoComments, updateComment, deleteComment };
