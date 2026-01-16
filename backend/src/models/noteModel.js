const mongoose = require('mongoose');

const NOTE_STATUSES = ['not_done', 'done', 'cancelled'];

// Keep categories stable for filtering/search.
// You can add more categories later without breaking existing notes.
const NOTE_CATEGORIES = ['Study', 'Health', 'Finance', 'Work', 'Personal', 'Other'];

const NoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    // Cancellation is explicit. Otherwise, status is derived from progress.
    status: {
      type: String,
      enum: NOTE_STATUSES,
      default: 'not_done',
      index: true,
    },

    // 0..100. UI: 0 = Not started, 100 = Done.
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true,
    },

    category: {
      type: String,
      enum: NOTE_CATEGORIES,
      default: 'Other',
      index: true,
    },

    deadline: {
      type: Date,
      default: null,
      index: true,
    },

    priority: {
      type: Number,
      min: 0,
      max: 1024,
      default: 0,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

NoteSchema.index({ user: 1, isDeleted: 1, priority: -1, updatedAt: -1 });
NoteSchema.index({ user: 1, category: 1, isDeleted: 1, updatedAt: -1 });

const Note = mongoose.model('Note', NoteSchema);
module.exports = Note;
module.exports.NOTE_STATUSES = NOTE_STATUSES;
module.exports.NOTE_CATEGORIES = NOTE_CATEGORIES;
