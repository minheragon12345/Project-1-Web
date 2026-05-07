const mongoose = require('mongoose');
const NOTE_STATUSES = ['not_done', 'done', 'cancelled'];
const NOTE_CATEGORIES = ['Study', 'Health', 'Finance', 'Work', 'Personal', 'Other'];

const NoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },

    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    estimatedHours: {
      type: Number,
      min: 0,
      default: 0,
    },

    actualHours: {
      type: Number,
      min: 0,
      default: 0,
    },

    parentTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note',
      default: null,
      index: true,
    },

    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
      },
    ],

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

    status: {
      type: String,
      enum: NOTE_STATUSES,
      default: 'not_done',
      index: true,
    },

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

    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true, trim: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

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
NoteSchema.index({ project: 1, isDeleted: 1, status: 1, priority: -1 });
NoteSchema.index({ assignees: 1, isDeleted: 1, status: 1 });
NoteSchema.index({ parentTask: 1, isDeleted: 1 });
NoteSchema.index({ dependencies: 1, isDeleted: 1 });

const Note = mongoose.model('Note', NoteSchema);
module.exports = Note;
module.exports.NOTE_STATUSES = NOTE_STATUSES;
module.exports.NOTE_CATEGORIES = NOTE_CATEGORIES;
