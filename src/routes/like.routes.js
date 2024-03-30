import { Router } from "express";
import {
  getLikedVideos,
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
} from "../controllers/like.controller";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJwt);
router.route("/video-like/:videoId").post(toggleVideoLike);
router.route("/comment-like/:commentId").post(toggleCommentLike);
router.route("/tweet-like/:tweetId").post(toggleTweetLike);

router.route("/get-liked-videos").get(getLikedVideos);
