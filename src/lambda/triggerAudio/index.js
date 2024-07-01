const AWS = require('aws-sdk');
const MediaConvert = new AWS.MediaConvert({ apiVersion: '2017-08-29', endpoint: process.env.MEDIA_CONVERT_ENDPOINT });
const S3 = new AWS.S3();

exports.handler = async (event) => {
    const key = event.Records[0].s3.object.key;
    const inputBucket = event.Records[0].s3.bucket.name;
    const outputBucket = process.env.OUTPUT_BUCKET;
    
    const inputFile = `s3://${inputBucket}/${key}`;
    const outputFile = `s3://${outputBucket}/${key.split('.')[0]}_converted.mp3`; // Assuming output as mp3

    const params = {
        Role: process.env.MEDIA_CONVERT_ROLE,
        Settings: {
            OutputGroups: [
                {
                    Name: 'File Group',
                    OutputGroupSettings: {
                        Type: 'FILE_GROUP_SETTINGS',
                        FileGroupSettings: {
                            Destination: outputFile
                        }
                    },
                    Outputs: [
                        {
                            ContainerSettings: {
                                Container: 'MP3',
                                Mp3Settings: {}
                            },
                            AudioDescriptions: [
                                {
                                    CodecSettings: {
                                        Codec: 'MP3',
                                        Mp3Settings: {
                                            Bitrate: 128000,
                                            SampleRate: 44100
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            ],
            Inputs: [
                {
                    FileInput: inputFile,
                    AudioSelectors: {
                        'Audio Selector 1': {
                            SelectorType: 'TRACK',
                            Tracks: [1]
                        }
                    }
                }
            ]
        }
    };

    try {
        const data = await MediaConvert.createJob(params).promise();
        console.log('Job created! Job ID:', data.Job.Id);
    } catch (err) {
        console.log('Error', err);
    }
};
