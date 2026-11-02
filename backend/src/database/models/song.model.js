/**
 * Song Mongoose Model
 * -------------------
 * Attached to the dedicated Songs Database connection.
 * Stores non-statistical music metadata required for search and client presentation:
 * Title, Artists, Album, Duration, Release info.
 */

import mongoose from 'mongoose';
import { songsConnection } from '../connection.js';

export const songSchema = new mongoose.Schema(
  {
    track_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      alias: 'id',
    },
    name: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    album: {
      type: String,
      default: '',
    },
    album_id: {
      type: String,
      default: '',
    },
    artists: {
      type: [String],
      default: [],
      index: true,
    },
    artist_ids: {
      type: [String],
      default: [],
    },
    duration_ms: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      index: true,
    },
    release_date: {
      type: String,
      default: '',
    },
    explicit: {
      type: Boolean,
      default: false,
    },
    track_number: {
      type: Number,
      default: 1,
    },
    disc_number: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    collection: 'songs',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound text index for search
songSchema.index({ name: 'text', album: 'text' });

/**
 * Returns Song model attached to songsConnection or fallback default mongoose
 */
export function getSongModel(conn = songsConnection) {
  if (conn) {
    return conn.models.Song || conn.model('Song', songSchema);
  }
  return mongoose.models.Song || mongoose.model('Song', songSchema);
}

// Lazy getter proxy for standard model operations
export const Song = new Proxy(
  {},
  {
    get(target, prop) {
      const model = getSongModel();
      const val = model[prop];
      return typeof val === 'function' ? val.bind(model) : val;
    },
  }
);
