# SkillGig Course Management API Documentation

## Overview

This document outlines the API flow for the SkillGig course management system, detailing the sequence of API calls and their responses to provide a complete learning experience.

## Authentication

All APIs require authentication via the `authenticateUserTokenMiddleware`. Include the user token in the request headers.

## API Flow Sequence

### 1. Get Ongoing and Upcoming Courses

**Purpose**: Get user's current learning status and available courses
**Endpoint**: `GET /api/v1/roadmap/roadmap-course/ongoing-courses`
**Dependencies**: None (Entry point)

#### Request

```http
GET /api/v1/roadmap/roadmap-course/ongoing-courses
Authorization: <user_token>
```

#### Response

```json
{
  "roadmapName": "Java Full Stack Engineering",
  "currentOngoingCourses": [
    {
      "roadmapCourseId": 12,
      "courseId": 92,
      "courseTitle": "Java Full Stack Development - Starter Kit 1",
      "courseDescription": "Learn the basics of Java and Spring Boot in this starter kit.",
      "courseThumbnailUrl": "https://example.com/java-starter-kit-1.jpg",
      "completedModules": 0,
      "totalModules": 4,
      "progressPercent": "0.00",
      "currentModuleWeek": 1,
      "currentSectionId": 78,
      "courseStatus": "in-progress",
      "currentChapter": {
        "chapterId": 62,
        "title": "Introduction to Java",
        "description": "Learn the basics of Java programming language.",
        "contentType": "video",
        "contentRefId": 123,
        "userWatchDuration": 9,
        "chapterTotalDuration": 10,
        "isCompleted": false,
        "currentQuizAttempt": {
          "attemptId": 456,
          "score": 8.5,
          "totalPoints": 10.0,
          "status": "completed",
          "startedAt": "2025-07-10T10:00:00Z",
          "completedAt": "2025-07-10T10:15:00Z"
        },
        "latestProjectSubmission": {
          "submissionId": 789,
          "attemptNumber": 2,
          "githubUrl": "https://github.com/user/project",
          "docUrl": "https://docs.google.com/document/...",
          "deployedUrl": "https://myproject.vercel.app",
          "submissionComment": "Implemented all required features",
          "status": "approved",
          "tutorComment": "Excellent work! Great implementation.",
          "reviewedBy": 101,
          "submittedAt": "2025-07-10T14:30:00Z",
          "reviewedAt": "2025-07-10T16:00:00Z"
        }
      }
    }
  ],
  "upcomingCourses": [
    {
      "roadmapCourseId": 13,
      "courseId": 93,
      "courseTitle": "Advanced Java Concepts",
      "courseDescription": "Deep dive into advanced Java topics",
      "courseThumbnailUrl": "https://example.com/advanced-java.jpg",
      "estimatedDuration": "40 hours",
      "orderSequence": 2,
      "courseStatus": "ready-to-enroll"
    }
  ]
}
```

#### Next Steps

- If `currentOngoingCourses` has items, proceed to **Step 2** with the first course's `roadmapCourseId`
- If no ongoing courses, user can enroll in courses from `upcomingCourses`

---

### 2. Get Course Details

**Purpose**: Get detailed information about a specific course
**Endpoint**: `GET /api/v1/roadmap/roadmap-course/course-details`
**Dependencies**: Step 1 - requires `roadmapCourseId` from ongoing courses

#### Request

```http
GET /api/v1/roadmap/roadmap-course/course-details?roadmapCourseId=12&roadmapId=5
Authorization: <user_token>
```

#### Parameters

- `roadmapCourseId`: From Step 1 response
- `roadmapId`: From Step 1 response (extract from roadmap context)

#### Response

```json
{
  "courseDetails": {
    "courseId": 92,
    "courseTitle": "Java Full Stack Development - Starter Kit 1",
    "courseDescription": "Learn the basics of Java and Spring Boot",
    "imageUrl": "https://example.com/course-thumbnail.jpg",
    "tutorId": 15
  },
  "tutorDetails": {
    "tutorId": 15,
    "tutorName": "John Doe",
    "tutorBio": "Senior Java Developer with 10+ years experience",
    "profileImageUrl": "https://example.com/tutor-profile.jpg"
  },
  "tags": [
    {"tagId": 1, "tagTitle": "Java"},
    {"tagId": 2, "tagTitle": "Spring Boot"}
  ],
  "learnings": [
    {
      "learningId": 1,
      "learningTitle": "Core Java Concepts",
      "learningDescription": "Understanding OOP, Collections, etc."
    }
  ],
  "reviews": [
    {
      "reviewId": 1,
      "rating": 4.5,
      "review": "Great course for beginners",
      "reviewerName": "Jane Smith",
      "createdAt": "2025-07-01T10:00:00Z"
    }
  ],
  "modules": [
    {
      "moduleWeek": 1,
      "totalDurationOfModule": 120,
      "totalSectionsUnderModule": 3,
      "totalVideosUnderModule": 8,
      "totalDocsUnderModule": 2,
      "totalQuizzesUnderModule": 1,
      "totalProjectsUnderModule": 1,
      "sections": [...]
    }
  ],
  "currentRoadmapStatus": "in-progress",
  "currentRoadmapCourseStatus": "in-progress",
  "certificateUrl": null,
  "preRequisiteCourseDetails": null,
  "ongoingCurrentModuleWeek": 1
}
```

#### Next Steps

- If `currentRoadmapCourseStatus` === "in-progress", proceed to **Step 3**
- Use `ongoingCurrentModuleWeek` for the next API call

---

### 3. Get Course Summary

**Purpose**: Get module-wise progress summary of the course
**Endpoint**: `GET /api/v1/roadmap/roadmap-course/summary`
**Dependencies**: Step 2 - requires `roadmapCourseId`

#### Request

```http
GET /api/v1/roadmap/roadmap-course/summary?roadmapCourseId=12
Authorization: <user_token>
```

#### Response

```json
{
  "modules": [
    {
      "moduleWeek": 1,
      "totalVideos": 8,
      "completedVideos": 3,
      "totalReadings": 2,
      "completedReadings": 1,
      "totalQuizzes": 1,
      "completedQuizzes": 0,
      "moduleCompletionPercent": 45,
      "status": "in-progress"
    },
    {
      "moduleWeek": 2,
      "totalVideos": 6,
      "completedVideos": 0,
      "totalReadings": 1,
      "completedReadings": 0,
      "totalQuizzes": 1,
      "completedQuizzes": 0,
      "moduleCompletionPercent": 0,
      "status": "locked"
    }
  ],
  "overall": {
    "totalVideos": 14,
    "completedVideos": 3,
    "overallVideosPercent": 21,
    "totalReadings": 3,
    "completedReadings": 1,
    "overallReadingsPercent": 33,
    "totalQuizzes": 2,
    "completedQuizzes": 0,
    "overallQuizzesPercent": 0,
    "overallCompletionPercent": 22
  },
  "currentModule": {
    "moduleWeek": 1,
    "status": "in-progress",
    "moduleCompletionPercent": 45
  }
}
```

#### Next Steps

- Use `currentModule.moduleWeek` for **Step 4**
- Proceed to get detailed module information

---

### 4. Get Module Details

**Purpose**: Get detailed chapter information for a specific module
**Endpoint**: `GET /api/v1/roadmap/roadmap-course/module-details`
**Dependencies**: Step 3 - requires `currentModule.moduleWeek`

#### Request

```http
GET /api/v1/roadmap/roadmap-course/module-details?roadmapCourseId=12&moduleWeek=1
Authorization: <user_token>
```

#### Response

```json
{
  "sections": [
    {
      "sectionId": 78,
      "sectionTitle": "Introduction to Java",
      "sectionDescription": "Basic concepts of Java programming",
      "chapters": [
        {
          "chapterId": 62,
          "contentType": "video",
          "chapterTitle": "What is Java?",
          "chapterDescription": "Introduction to Java programming language",
          "watchedDuration": 5,
          "totalDuration": 10,
          "isUnlocked": true,
          "unlockedAt": "2025-07-10T09:00:00Z",
          "isCompleted": false,
          "completionPercent": 50,
          "contentRefId": 123,
          "quizXpPoints": null,
          "quizMappingId": null,
          "currentQuizAttempt": null,
          "projectXpPoints": null,
          "projectMappingId": null,
          "latestProjectSubmission": null
        },
        {
          "chapterId": 63,
          "contentType": "quiz",
          "chapterTitle": "Java Basics Quiz",
          "chapterDescription": "Test your knowledge of Java basics",
          "watchedDuration": 0,
          "totalDuration": 15,
          "isUnlocked": true,
          "unlockedAt": "2025-07-10T10:00:00Z",
          "isCompleted": false,
          "completionPercent": 0,
          "contentRefId": 456,
          "quizXpPoints": 50,
          "quizMappingId": 789,
          "currentQuizAttempt": {
            "attemptId": 101,
            "score": null,
            "totalPoints": 10.0,
            "status": "in_progress",
            "startedAt": "2025-07-10T11:00:00Z",
            "completedAt": null
          },
          "projectXpPoints": null,
          "projectMappingId": null,
          "latestProjectSubmission": null
        },
        {
          "chapterId": 64,
          "contentType": "project",
          "chapterTitle": "Build a Simple Calculator",
          "chapterDescription": "Create a basic calculator using Java",
          "watchedDuration": 0,
          "totalDuration": 0,
          "isUnlocked": true,
          "unlockedAt": "2025-07-10T12:00:00Z",
          "isCompleted": false,
          "completionPercent": 0,
          "contentRefId": 789,
          "quizXpPoints": null,
          "quizMappingId": null,
          "currentQuizAttempt": null,
          "projectXpPoints": 100,
          "projectMappingId": 456,
          "latestProjectSubmission": {
            "submissionId": 201,
            "attemptNumber": 1,
            "githubUrl": "https://github.com/user/calculator",
            "docUrl": null,
            "deployedUrl": null,
            "submissionComment": "Initial submission",
            "status": "submitted",
            "tutorComment": null,
            "reviewedBy": null,
            "submittedAt": "2025-07-10T15:00:00Z",
            "reviewedAt": null
          }
        }
      ],
      "sectionTotalChapters": 3,
      "sectionOverallSummary": {
        "totalChapters": 3,
        "completedChapters": 0,
        "sectionCompletionPercent": 0,
        "isUnlocked": true,
        "isCompleted": false
      }
    }
  ],
  "overallSummary": {
    "currentSectionId": 78,
    "currentChapterId": 62,
    "latestUnlockedAt": "2025-07-10T12:00:00Z",
    "moduleUnlockedStatus": true
  }
}
```

#### Next Steps Based on Chapter Content Type

**For Video/Document Chapters:**

- Call Video API (Step 5a) with `chapterId`

**For Quiz Chapters:**

- Call Quiz API (Step 5b) with `chapterId` and `quizMappingId`

**For Project Chapters:**

- Call Project Details API (Step 5c) with `projectMappingId`
- Then Project Submission API (Step 6) for submissions

---

### 5a. Video/Document Content API

**Purpose**: Get video or document content for learning
**Endpoint**: `[TO BE PROVIDED BY ANIRUDDH]`
**Dependencies**: Step 4 - requires `chapterId` from module details

#### Request

```http
[PLACEHOLDER - ANIRUDDH TO PROVIDE]
GET /api/v1/content/video?chapterId=62
Authorization: <user_token>
```

#### Expected Response Structure

```json
{
  "chapterId": 62,
  "contentType": "video",
  "videoUrl": "https://stream.example.com/video123",
  "subtitles": "https://example.com/subtitles/en.vtt",
  "duration": 600,
  "quality": ["720p", "1080p"],
  "bookmarks": [
    {
      "time": 120,
      "title": "Introduction to Variables"
    }
  ]
}
```

---

### 5b. Quiz Content API

**Purpose**: Get quiz questions and handle quiz attempts
**Endpoint**: `[TO BE PROVIDED BY PRADHYUM]`
**Dependencies**: Step 4 - requires `chapterId` and `quizMappingId`

#### Request

```http
[PLACEHOLDER - PRADHYUM TO PROVIDE]
GET /api/v1/quiz/questions?chapterId=63&quizMappingId=789
Authorization: <user_token>
```

#### Expected Response Structure

```json
{
  "quizId": 456,
  "quizMappingId": 789,
  "chapterId": 63,
  "title": "Java Basics Quiz",
  "description": "Test your knowledge of Java basics",
  "timeLimit": 900,
  "totalPoints": 10,
  "questions": [
    {
      "questionId": 1,
      "questionText": "What is Java?",
      "questionType": "multiple_choice",
      "options": [
        { "optionId": 1, "text": "Programming Language" },
        { "optionId": 2, "text": "Coffee" },
        { "optionId": 3, "text": "Island" },
        { "optionId": 4, "text": "All of the above" }
      ],
      "points": 2
    }
  ],
  "currentAttempt": {
    "attemptId": 101,
    "status": "in_progress",
    "startedAt": "2025-07-10T11:00:00Z",
    "timeRemaining": 750
  }
}
```

---

### 5c. Get Project Details

**Purpose**: Get project requirements and specifications
**Endpoint**: `GET /api/v1/roadmap/roadmap-course/project-details`
**Dependencies**: Step 4 - requires `projectMappingId`

#### Request

```http
GET /api/v1/roadmap/roadmap-course/project-details?projectMappingId=456
Authorization: <user_token>
```

#### Response

```json
{
  "projectMappingId": 456,
  "projectId": 789,
  "projectTitle": "Build a Simple Calculator",
  "projectDescription": "Create a basic calculator application using Java",
  "projectInstructions": "1. Create a Calculator class\n2. Implement basic operations\n3. Add error handling\n4. Write unit tests",
  "requiredFormat": "java_application",
  "isActive": true,
  "xpPoints": 100,
  "estimatedDuration": "4 hours",
  "difficulty": "beginner",
  "requirements": ["Java 11 or higher", "JUnit for testing", "Git for version control"],
  "deliverables": ["Source code on GitHub", "README with setup instructions", "Unit test cases"],
  "evaluation_criteria": [
    "Code quality and structure",
    "Functionality completeness",
    "Test coverage",
    "Documentation quality"
  ]
}
```

#### Next Steps

- Use this information to work on the project
- Submit project using **Step 6**

---

### 6. Submit Project

**Purpose**: Submit project work for review
**Endpoint**: `POST /api/v1/roadmap/roadmap-course/project-submission`
**Dependencies**: Step 5c - requires project details

#### Request

```http
POST /api/v1/roadmap/roadmap-course/project-submission
Authorization: <user_token>
Content-Type: application/json

{
  "contentRefId": 789,
  "githubUrl": "https://github.com/username/calculator-project",
  "docUrl": "https://docs.google.com/document/d/...",
  "deployedUrl": "https://calculator.vercel.app",
  "submissionComment": "Implemented all required features with additional error handling"
}
```

#### Response

```json
{
  "success": true,
  "submissionId": 201,
  "attemptNumber": 1,
  "status": "submitted",
  "submittedAt": "2025-07-10T15:30:00Z",
  "message": "Project submitted successfully for review",
  "estimatedReviewTime": "24-48 hours"
}
```

---

## Additional APIs

### Get User Notes

**Endpoint**: `GET /api/v1/roadmap/roadmap-course/notes`

### Add User Note

**Endpoint**: `POST /api/v1/roadmap/roadmap-course/notes`

### Edit User Note

**Endpoint**: `PUT /api/v1/roadmap/roadmap-course/notes`

---

## Error Handling

All APIs follow a consistent error response format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

Common HTTP Status Codes:

- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

---

## API Flow Summary

1. **Start**: `GET /ongoing-courses` → Get current learning status
2. **Course Info**: `GET /course-details` → Get course overview
3. **Progress**: `GET /summary` → Get module progress
4. **Module Content**: `GET /module-details` → Get chapter details
5. **Content Consumption**:
   - Video/Doc: Call Aniruddh's API
   - Quiz: Call Pradhyum's API
   - Project: `GET /project-details` → `POST /project-submission`

This flow ensures users have a complete learning experience with proper content delivery based on their progress and content type.
