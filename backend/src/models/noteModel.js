const mongoose = require('mongoose');
const NOTE_STATUSES = ['not_done', 'done', 'cancelled'];
const NOTE_CATEGORIES = ['Study', 'Health', 'Finance', 'Work', 'Personal', 'Other'];
const SHARE_PERMISSIONS = ['read', 'comment', 'write'];

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

    sharedWith: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        permission: { type: String, enum: SHARE_PERMISSIONS, default: 'read' },
        sharedAt: { type: Date, default: Date.now },
        sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],

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
NoteSchema.index({ 'sharedWith.user': 1, isDeleted: 1, updatedAt: -1 });

const Note = mongoose.model('Note', NoteSchema);
module.exports = Note;
module.exports.NOTE_STATUSES = NOTE_STATUSES;
module.exports.NOTE_CATEGORIES = NOTE_CATEGORIES;
module.exports.SHARE_PERMISSIONS = SHARE_PERMISSIONS;
