import { Router } from "express";
import {
  createTweet,
  deleteTweet,
  getAllTweets,
  getTweetsByUserId,
  updateTweet,
} from "../controllers/tweet.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, createTweet);
router.route("/update/:tweetId").patch(verifyJWT, updateTweet);
router.route("/delete/:tweetId").delete(verifyJWT, deleteTweet);
router.route('/').get(getAllTweets)
router.route('/:userId').get(getTweetsByUserId)
export default router;
