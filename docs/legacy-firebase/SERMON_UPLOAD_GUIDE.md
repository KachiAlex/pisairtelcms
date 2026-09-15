# Sermon Upload Feature Guide

## Overview

The Sermon Hub now supports comprehensive media upload capabilities for tenant admins, allowing them to upload sermons via multiple methods and stream them directly on Ecclesia.

## Features

### 🎥 Multiple Upload Methods

1. **URL/Link Upload**
   - YouTube videos (auto-embedded)
   - Vimeo videos (auto-embedded)
   - Telegram links (auto-embedded)
   - Direct video/audio URLs

2. **File Upload**
   - Video files (MP4, WebM, MOV, MKV)
   - Audio files (MP3, WAV, M4A, OGG)
   - Thumbnail images (JPG, PNG, WebP)

### 📦 File Size Limits

- **Video**: 500MB
- **Audio**: 100MB
- **Thumbnail**: 5MB

### 🎬 Supported Platforms

#### YouTube
- Automatically converts YouTube links to embedded player
- Supports standard YouTube URLs and youtu.be short links
- Resumes from last watched position

#### Vimeo
- Automatically converts Vimeo links to embedded player
- Supports all Vimeo URL formats

#### Telegram
- Embeds Telegram video/audio content
- Converts t.me links to embedded format

#### Direct Files
- Supports direct video/audio file uploads
- Stored in Firebase Storage with public access
- Optimized for streaming

## Usage

### For Admins

1. **Access Upload Page**
   - Navigate to Sermon Hub
   - Click "Upload Sermon" button (visible only to Admins/Pastors)

2. **Fill Sermon Details**
   - Title* (required)
   - Speaker* (required)
   - Description (recommended for AI summaries)
   - Category (Sunday Service, Bible Study, etc.)
   - Duration in minutes
   - Tags (comma-separated)

3. **Choose Upload Method**

   **Option A: URL/Link**
   - Paste YouTube, Vimeo, Telegram, or direct media URL
   - System automatically detects platform and configures player
   - Add optional audio URL for audio-only option
   - Add optional thumbnail URL

   **Option B: File Upload**
   - Select video file from device
   - Optionally add audio file for audio-only streaming
   - Upload thumbnail image
   - Files are uploaded to Firebase Storage
   - Progress bars show upload status

4. **Submit**
   - Click "Upload Sermon"
   - System processes uploads and creates sermon
   - AI generates summary if description provided
   - Redirects to sermon player page

### For Members

1. **Browse Sermons**
   - View all sermons in Sermon Hub
   - Search by title, speaker, or description
   - Filter by category
   - See "Continue Watching" for unfinished sermons

2. **Watch/Listen**
   - Click any sermon to open player
   - Player automatically detects media type
   - YouTube/Vimeo/Telegram videos play embedded
   - Direct files stream from Firebase Storage
   - Progress automatically tracked
   - Resume from where you left off

3. **Download**
   - Click "Download" button
   - Downloads are tracked for analytics
   - Access offline if supported

## Technical Architecture

### Storage
- **Firebase Storage**: Stores uploaded media files
- **Firestore**: Stores sermon metadata and tracking
- **Path Structure**: `sermons/{churchId}/{type}/{filename}`

### Media Processing
1. **URL Method**
   - Detects platform (YouTube, Vimeo, Telegram, Direct)
   - Converts to embed URL if applicable
   - Stores original and embed URLs

2. **File Method**
   - Validates file type and size
   - Generates unique filename with UUID
   - Uploads to Firebase Storage
   - Makes file publicly accessible
   - Returns public URL

### Player
- **MediaPlayer Component**: Universal player supporting all formats
- **Auto-detection**: Determines embed type from URL
- **Progress Tracking**: Updates every 10 seconds
- **Resume Playback**: Starts from last watched position
- **Responsive**: Works on mobile and desktop

## Environment Variables

Required for file uploads:

```env
# Firebase Storage (automatically configured if Firebase is set up)
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

## API Endpoints

### POST `/api/sermons/upload`
Upload media file to Firebase Storage

**Body**: FormData
- `file`: File (video/audio/thumbnail)
- `type`: 'video' | 'audio' | 'thumbnail'

**Response**:
```json
{
  "success": true,
  "url": "https://storage.googleapis.com/...",
  "fileName": "uuid.ext",
  "fileSize": 1234567,
  "fileType": "video/mp4"
}
```

### POST `/api/sermons`
Create new sermon

**Body**:
```json
{
  "title": "Sermon Title",
  "speaker": "Pastor Name",
  "description": "Sermon description",
  "videoUrl": "https://...",
  "audioUrl": "https://...",
  "thumbnailUrl": "https://...",
  "duration": 2700,
  "category": "Sunday Service",
  "tags": ["faith", "prayer"]
}
```

## Best Practices

### For Uploading
1. **Use Descriptions**: Detailed descriptions help AI generate better summaries
2. **Add Thumbnails**: Improves visual appeal and engagement
3. **Choose Right Format**: 
   - YouTube/Vimeo for already uploaded videos
   - Direct upload for original content
   - Telegram for community sharing
4. **Add Duration**: Helps with progress tracking
5. **Tag Appropriately**: Makes sermons searchable

### For Members
1. **Stable Connection**: Ensure good internet for streaming
2. **Download**: Download sermons for offline viewing
3. **Complete Watching**: Tracked progress helps you resume later

## Troubleshooting

### Upload Fails
- **Check file size**: Must be under limits
- **Check file format**: Only supported formats work
- **Check Firebase**: Ensure Firebase Storage is configured
- **Check permissions**: Only Admins/Pastors can upload

### Video Not Playing
- **YouTube/Vimeo**: Check if video is public
- **Telegram**: Verify link is accessible
- **Direct files**: Ensure file uploaded successfully

### Progress Not Saving
- **Login Required**: Must be authenticated
- **10-second intervals**: Progress updates every 10 seconds
- **Check network**: Ensure stable connection

## Future Enhancements

- [ ] Video transcoding for optimal streaming
- [ ] Subtitle support
- [ ] Live streaming integration
- [ ] Playlist creation
- [ ] Series management
- [ ] Advanced analytics
- [ ] Social sharing
- [ ] Comments and reactions

## Support

For issues or questions:
1. Check this documentation
2. Contact system administrator
3. Report bugs via support channel

