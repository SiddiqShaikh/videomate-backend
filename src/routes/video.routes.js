import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
  deleteVideo,
  getVideoById,
  getVideos,
  updateVideo,
  uploadVideo,
} from "../controllers/video.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/upload-video").post(
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1,
    },
    { name: "thumbnail", maxCount: 1 },
  ]),
  uploadVideo
);
router
  .route("/update-video/:videoId")
  .patch(upload.single("thumbnail"), updateVideo);
router.route("/get-videos").get(getVideos);
router.route("/get-video/:videoId").get(getVideoById);
router.route("/video/:videoId").delete(deleteVideo);

export default router;
