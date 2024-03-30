import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Playlist } from "../models/playlist.model.js";
import { isValidObjectId } from "mongoose";

const createPlaylist = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (![title, description].some((field) => field.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }
  const createdPlaylist = await Playlist.create({
    name: title,
    description: description,
    owner: req.user?._id,
  });
  if (!createdPlaylist) {
    throw new ApiError(500, "Internal Server Error!");
  }
  return res
    .status(201)
    .json(
      new ApiResponse(201, createdPlaylist, "Playlist Created Successfully!")
    );
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist Id");
  }
  if (!title && !description) {
    throw new ApiError(400, "All Fields are required");
  }
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found!");
  }
  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(401, "Unauthorized to edit this playlist!");
  }
  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlist._id,
    {
      $set: {
        name: title,
        description,
      },
    },
    { new: true }
  );
  if (!updatedPlaylist) {
    throw new ApiError(500, "Internal Server Error");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Successfully Update Playlist!")
    );
});

export { createPlaylist, updatePlaylist };
