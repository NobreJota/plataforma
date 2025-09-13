const AWS = require("aws-sdk");
require("dotenv").config();

const spacesEndpoint = new AWS.Endpoint(process.env.S3_ENDPOINT || "nyc3.digitaloceanspaces.com");

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
  region: "us-east-1"
});

module.exports = s3;