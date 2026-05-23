const mongoose = require('mongoose');

const TimeEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note',
      required: true,
      index: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },

    hours: {
      type: Number,
      required: true,
      min: 0,
      max: 24,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    billable: {
      type: Boolean,
      default: true,
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
  { timestamps: true },
);

TimeEntrySchema.index({ task: 1, isDeleted: 1 });
TimeEntrySchema.index({ user: 1, date: -1, isDeleted: 1 });
TimeEntrySchema.index({ project: 1, date: -1, isDeleted: 1 });

const TimeEntry = mongoose.model('TimeEntry', TimeEntrySchema);
module.exports = TimeEntry;
