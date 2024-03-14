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

export { toggleSubscription };
