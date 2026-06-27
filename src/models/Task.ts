import mongoose from 'mongoose';

const SubtaskSchema = new mongoose.Schema({
  text: String,
  completed: Boolean
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  type: {
    type: String, // 'image' or 'link'
  },
  name: String,
  url: String,
  data: String // For base64 images
}, { _id: false });

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  color: String,
  deadline: String,
  priority: String,
  period: String,
  assignee: String,
  mode: {
    type: String,
    required: true,
  },
  uid: {
    type: String,
    required: true,
  },
  department: String,
  status: {
    type: String,
    default: 'todo'
  },
  subtasks: [SubtaskSchema],
  attachments: [AttachmentSchema]
}, { timestamps: true });

export default mongoose.models.Task || mongoose.model('Task', TaskSchema);
