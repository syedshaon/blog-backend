const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const authorSchema = new Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    virtual: true,
    get() {
      return `/users/${this._id}`;
    },
  },
  isactive: {
    type: String,
    enum: ["true", "false"],
    default: "false",
    required: false,
  },
});

// Compile the schema into a model
// Export the model
module.exports = mongoose.model("Author", authorSchema);
