const AWS = require('aws-sdk');

const mediaConvert = new AWS.MediaConvert({ endpoint: process.env.ENDPOINT });

exports.handler = async (event) => {
  const srcBucket = event.Records[0].s3.bucket.name;
  const srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  const dstBucket = process.env.DEST_BUCKET;
  const role = process.env.MEDIA_CONVERT_ROLE;

  const params = {
    Role: role,
    Settings: {
      Inputs: [
        {
          FileInput: `s3://${srcBucket}/${srcKey}`,
          AudioSelectors: {
            'Audio Selector 1': {
              DefaultSelection: 'DEFAULT',
            },
          },
          VideoSelector: {
            ColorSpace: 'FOLLOW',
          },
        },
      ],
      OutputGroups: [
        {
          Name: 'File Group',
          OutputGroupSettings: {
            Type: 'FILE_GROUP_SETTINGS',
            FileGroupSettings: {
              Destination: `s3://${dstBucket}/output/`,
            },
          },
          Outputs: [
            {
              ContainerSettings: {
                Container: 'MP4',
              },
              VideoDescription: {
                CodecSettings: {
                  Codec: 'H_264',
                  H264Settings: {
                    RateControlMode: 'QVBR',
                    SceneChangeDetect: 'ENABLED',
                    QualityTuningLevel: 'SINGLE_PASS',
                    MaxBitrate: 5000000,
                  },
                },
              },
              AudioDescriptions: [
                {
                  CodecSettings: {
                    Codec: 'AAC',
                    AacSettings: {
                      Bitrate: 160000,
                      CodingMode: 'CODING_MODE_2_0',
                      SampleRate: 48000,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };

  try {
    const result = await mediaConvert.createJob(params).promise();
    console.log('Job created successfully', result);
  } catch (error) {
    console.error('Error creating MediaConvert job', error);
    throw error;
  }
};
