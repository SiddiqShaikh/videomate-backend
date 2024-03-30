import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
  {
    videoFile: {
      // type: String, // service provider url
      type: {
        url: String, // cloudinary fetch video
        public_id: String, // to delete or modify from cloudinary
      },
      required: true,
    },
    thumbnail: {
      // type: String, // service provider url
      type: {
        url: String,
        public_id: String,
      },
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // service provider gives info like cloudinary
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    views:{
      type:Number
    }
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);
