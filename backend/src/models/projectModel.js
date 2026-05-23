const mongoose = require('mongoose');

const PROJECT_STATUSES = ['active', 'archived'];
const MEMBER_ROLES = ['owner', 'moderator', 'editor', 'reviewer', 'viewer'];
const ASSIGNABLE_MEMBER_ROLES = ['moderator', 'editor', 'reviewer', 'viewer'];
const BUDGET_TYPES = ['fixed', 'hourly'];
const TIME_UNITS = ['hour', 'day', 'week', 'month'];

const ProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: MEMBER_ROLES, default: 'viewer' },
        addedAt: { type: Date, default: Date.now },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],

    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'active',
      index: true,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    budget: {
      amount: { type: Number, min: 0, default: 0 },
      currency: { type: String, trim: true, maxlength: 8, default: 'USD' },
      type: { type: String, enum: BUDGET_TYPES, default: 'hourly' },
    },

    timeUnit: {
      type: String,
      enum: TIME_UNITS,
      default: 'day',
    },

    maxHeadcount: {
      type: Number,
      min: 1,
      default: null,
    },

    lostRevenuePerUnit: {
      type: Number,
      min: 0,
      default: null,
    },

    // Optional non-linear lost-revenue lookup, keyed by project duration in
    // `timeUnit`s. When set, takes precedence over `lostRevenuePerUnit` in
    // /crash-analysis. Example: { "16": 20, "15": 15, "14": 10, "13": 6 }
    lostRevenueByDuration: {
      type: Map,
      of: Number,
      default: null,
    },

    isPersonal: {
      type: Boolean,
      default: false,
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

ProjectSchema.index({ owner: 1, isDeleted: 1, status: 1, updatedAt: -1 });
ProjectSchema.index({ 'members.user': 1, isDeleted: 1, updatedAt: -1 });

const Project = mongoose.model('Project', ProjectSchema);
module.exports = Project;
module.exports.PROJECT_STATUSES = PROJECT_STATUSES;
module.exports.MEMBER_ROLES = MEMBER_ROLES;
module.exports.ASSIGNABLE_MEMBER_ROLES = ASSIGNABLE_MEMBER_ROLES;
module.exports.BUDGET_TYPES = BUDGET_TYPES;
module.exports.TIME_UNITS = TIME_UNITS;
