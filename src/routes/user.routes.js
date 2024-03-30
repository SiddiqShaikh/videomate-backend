import { Router } from "express";

// controllers
import {
  UpdateCoverImage,
  changeCurrentPassword,
  getCurrentUser,
  getUserChannelProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateProfileImage,
} from "../controllers/user.controller.js";

// middlewares
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);
router.route("/login").post(loginUser);

//secured token routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

router.route("/get-profile").get(verifyJWT, getCurrentUser);
router
  .route("/user-channel-profile/:username")
  .get(verifyJWT, getUserChannelProfile);
router.route("/watch-history").get(verifyJWT,getWatchHistory)

router.route("/update-profile").patch(verifyJWT, updateAccountDetails);
router
  .route("/profile-image")
  .patch(upload.single("avatar"), verifyJWT, updateProfileImage);
router
  .route("/cover-image")
  .patch(upload.single("coverImage"), verifyJWT, UpdateCoverImage);


export default router;
