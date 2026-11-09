from app.core.database import Base
from app.models.department import Department
from app.models.user import User
from app.models.test import Test
from app.models.question import Question, QuestionOption
from app.models.attempt import Attempt, AttemptAnswer
from app.models.assignment import TestAssignment
from app.models.bank_question import BankQuestion, BankQuestionOption

from app.models.course import (
    Course,
    CourseModule,
    CourseLesson,
    UserCourseEnrollment,
    UserLessonProgress,
    CourseAssignment,
)
from app.models.knowledge import KnowledgeFile, KnowledgeFileAssignment

__all__ = [
    "Base",
    "Department",
    "User",
    "Test",
    "Question",
    "QuestionOption",
    "Attempt",
    "AttemptAnswer",
    "TestAssignment",
    "BankQuestion",
    "BankQuestionOption",
    "Course",
    "CourseModule",
    "CourseLesson",
    "UserCourseEnrollment",
    "UserLessonProgress",
    "CourseAssignment",
    "KnowledgeFile",
    "KnowledgeFileAssignment",
]
