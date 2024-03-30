import mongoose, { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.model";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

const toggleSubscription = asyncHandler(async (req, res) => {
  try {
    const channelId = req.params.channelId;
    const userId = req.user._id;
    const existedSubscription = await Subscription.findOne({
      $and: [{ subscriber: userId, channel: channelId }],
    });
    if (existedSubscription) {
      await Subscription.deleteOne({
        $and: [{ subscriber: userId, channel: channelId }],
      });
      return res
        .status(200)
        .json(new ApiResponse(200, "Unsubscribed Successfully"));
    }
    const subscription = await Subscription.create({
      subscriber: userId,
      channel: channelId,
    });
    const newSubscription = await Subscription.findById(subscription._id);
    if (!newSubscription) {
      throw new ApiError(400, "Something went wrong while Subscribing");
    }
    return res
      .status(200)
      .json(new ApiResponse(200, newSubscription, "Subscribe Successfully!"));
  } catch (err) {
    throw new ApiError(400, "Error while toggle subscription!");
  }
});
// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  // model subscriber - channel
  //get channel Id
  // check channel Id exist
  // if exists then get all documents of same channel Id and fill it up with subscribers

  let { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid Channel Id");
  }
  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Schema.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $lookup: {
              from: "subscription",
              localField: "_id",
              foreignField: "channel",
              as: "subscribedToSubscriber",
            },
          },
          {
            $addFields: {
              subscribedToSubscriber: {
                $cond: {
                  $if: {
                    $in: [channelId, "subscribedToSubscriber.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
              subscriberCount: {
                $size: "$subscribedToSubscriber",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscriber",
    },
    {
      $project: {
        _id: 0,
        subscriber: {
          _id: 1,
          username: 1,
          fullname: 1,
          avatar: 1,
          subscribedToSubscriber: 1,
          subscriberCount: 1,
        },
      },
    },
  ]);

  if (!subscribers.length) {
    throw new ApiError(400, "Invalid Channel Id");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribers, "Subscriber Fetched Successfully!")
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  // subscriberId --- subscriber --> documents fetch
  // join channels video and add latest video
  // unwind --> to seperate array elements of channels
  // project channel
  // return res
  const { subscriberId } = req.params;
  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid Subscriber Id!");
  }
  const subscribedChannels = Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "channel",
        as: "subscribedChannel",
        pipeline: [
          {
            $lookup: {
              from: "videos",
              foreignField: "_id",
              localField: "owner",
              as: "videos",
            },
          },
          {
            $addFields: {
              latestVideo: {
                $last: "$videos",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscribedChannel",
    },
    {
      $project: {
        _id: 0,
        subscribedChannel: {
          _id: 1,
          username: 1,
          fullname: 1,
          "avatar.url": 1,
          latestVideo: {
            _id: 1,
            "videoFile.url": 1,
            "thumbnail.url": 1,
            duration: 1,
            owner: 1,
            title: 1,
            description: 1,
            createdAt: 1,
            views: 1,
          },
        },
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribedChannels, "ChannelS Fetched Sucessfuly!")
    );
  
});
export { toggleSubscription, getUserChannelSubscribers,getSubscribedChannels };
