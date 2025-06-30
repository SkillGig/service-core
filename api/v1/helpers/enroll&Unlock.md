When the user wants to enroll to a roadmap (creating an entry to the below tables)
table -> user_enrolled_roadmaps

1. Enroll the user to the first course of the roadmap
   table -> user_course_progress (enrollUserToTheCourseInRoadmap)

2. Unlock the first module for the enrolled_course
   First add all the sections with module_week information to user_section_progress table
   Mark the first section in the first module_week as unlocked (processAllModulesOfCourseToUser) -> (processSectionUnlock)

3. Get the first chapter in the unlocked section and mark it unlocked
   table -> user_chapter_progress (processChapterProgress)

When the user wants to enroll to a course in the roadmap (creating an entry to the below tables)

1. Check if the prerequisite course is completed by the user
2. If not ask the user to complete it
3. If yes completed -> Then perform the below steps

4. Enroll the user to the first course of the roadmap
   table -> user_course_progress (enrollUserToTheCourseInRoadmap)

5. Unlock the first module for the enrolled_course
   First add all the sections with module_week information to user_section_progress table
   Mark the first section in the first module_week as unlocked (processAllModulesOfCourseToUser) -> (processSectionUnlock)

6. Get the first chapter in the unlocked section and mark it unlocked
   table -> user_chapter_progress (processChapterProgress)

commonController (updating the status of the values that are already present when course creation has happened)
unlockModuleOfCourseToTheUser
unlockSectionUnderCourse
unlockChapterToUserUnderCourse

When we are trying to unlock the next module to the user

1. First, check if the module is week 1
   a. if yes, then check if it is already unlocked if not unlock it
2. If not week 1
   a. check if all the sections in the previous week are completed
   i. inside the sectionCommonController it has to check if all the chapters in the section are completed or not
   b. if not then say please complete the previous module in order to unlock the next module

   c. if all the previous module sections are completed (all the chapters in all the sections are completed) then (unlockModuleOfCourseToTheUser)
   a. the first section in the previous module enrolled date and the last section completed date should have more than 7 days of difference.
   b. if the difference is not 7 days then we are not unlocking the next module
   c. if the diff is more than 7 days then we are going to unlock the next module (repeat unlocking the next module)
   b. unlock the section with (unlockSectionUnderCourse)
   c. unlock the chapter with (unlockChapterToUserUnderCourse)
