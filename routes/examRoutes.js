import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from "express";
import dotenv from "dotenv";
import {
    databases,
    database_id,
    studentMarksTable_id,
    pointsTable_id,
    Query,
} from "../appwriteServerConfig.js";
import {
    client,
    account,
    databasesQ,
    database_idQ,
    sstTablePLE_id,
    mathPLE_id,
    engTbalePLE_id,
    sciTablePLE_id,
    Permission,
    Role,
    QueryQ,
} from "../examsAppwriteConfig.js"; //Questions DB

const router = Router();
const PORT_NO = process.env.PORT_NO || 3009;

// ==================== FUNCTIONS ====================
const fetchQuestionsForSubject = async (subject) => {
    try {
        let collection_id;

        console.log("Determining subject...");

        switch (subject) {
            case "social-studies_ple":
                collection_id = sstTablePLE_id;
                break;
            case "mathematics_ple":
                collection_id = mathPLE_id;
                break;
            case "english-language_ple":
                collection_id = engTbalePLE_id;
                break;
            case "science_ple":
                collection_id = sciTablePLE_id;
                break;
            default:
                // collection_id = null;
                return;
        }

        console.log("Fetching subject questions...");

        const response = await databasesQ.listDocuments(
            database_idQ,
            collection_id,
            [QueryQ.limit(80), QueryQ.orderAsc("$id")]
        );

        const questions = response.documents;
        const questionData = questions;


        // Convert questions from JSON strings to JSON objects
        questionData.forEach((obj) => {
            obj.questions = obj.questions.map((q) => JSON.parse(q));
            // delete obj.$id
            delete obj.$createdAt
            delete obj.$updatedAt
            delete obj.$permissions
            delete obj.$databaseId
            delete obj.$collectionId
        });

        console.log("Finished fetching question data: ");
        return questionData;
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

const selectRandomQuestions = (questionsData, categoryIds, subjectName, userHistory, userId, educationLevel) => {
    let updatedUserHistory = {
        userId,
        subjectName,
        questionsJSON: { ...userHistory?.questionsJSON },  // Clone the existing history
        educationLevel,
    };

    let categoriesWithQuestions = categoryIds.map((categoryId) => {
        const category = questionsData.find((cat) => cat.category === categoryId);
        if (!category) {
            console.warn(`Category ${categoryId} not found`);
            return null;
        }

        // Retrieve attempted question IDs for this category from userHistory
        let attemptedQuestionIds = userHistory?.questionsJSON?.[categoryId] || [];
        let allQuestionIds = category.questions.map((question) => question.id);

        // Reset the attempted question IDs if they exceed or match all available questions
        if (attemptedQuestionIds.length >= allQuestionIds.length) {
            attemptedQuestionIds = [];
        }

        // Filter available questions that haven't been attempted
        let availableQuestions = category.questions.filter((question) => {
            let questionId = question.id;  // Keep original id
            return !attemptedQuestionIds.includes(questionId);
        });

        let numQuestions = 1;  // Default number of questions
        if (subjectName === 'social-studies_ple' && (categoryId === 36 || categoryId === 51)) {
            numQuestions = 5;
        }

        if (subjectName === 'english-language_ple') {
            if (categoryId === 31) {
                numQuestions = 20;
            }
            if (categoryId === 1 || categoryId === 6) {
                numQuestions = 5;
            }
            if (categoryId === 18) {
                numQuestions = 3;
            }
            if (categoryId === 6 || categoryId === 16 || categoryId === 21 || categoryId === 23 || categoryId === 25 || categoryId === 27 || categoryId === 29) {
                numQuestions = 2;
            }
            if (categoryId === 51 || categoryId === 52 || categoryId === 53 || categoryId === 54 || categoryId === 55) {
                numQuestions = 1;
            }
        }

        // If available questions are less than numQuestions, reset attempted history
        if (availableQuestions.length < numQuestions) {
            attemptedQuestionIds = [];  // Reset the history to ensure enough questions
            availableQuestions = category.questions;  // Reset available questions
        }

        // Randomly select questions from the available list
        let selectedQuestions = [...availableQuestions].sort(() => 0.5 - Math.random()).slice(0, numQuestions);

        // Handle insufficient new questions
        if (selectedQuestions.length < numQuestions) {
            let questionsNeeded = numQuestions - selectedQuestions.length;
            let additionalQuestions = [];

            // Select from the attempted question list to fill the gap
            for (let i = 0; i < questionsNeeded; i++) {
                if (attemptedQuestionIds.length > 0) {
                    let oldQuestionId = attemptedQuestionIds.shift();  // Remove the oldest question
                    let oldQuestion = category.questions.find((q) => q.id === oldQuestionId);
                    if (oldQuestion) {
                        additionalQuestions.push(oldQuestion);
                    }
                }
            }

            selectedQuestions = selectedQuestions.concat(additionalQuestions);

            // Clear the history for this category if all questions are used
            if (attemptedQuestionIds.length === 0) {
                updatedUserHistory.questionsJSON[categoryId] = [];
            }
        }

        // Update the questions with additional details
        const updatedQuestions = selectedQuestions.map((question) => {
            const updatedQuestion = { ...question };

            // Comment out the modification of `id` attributes
            // if (isEitherOrFormat(question)) {
            //     updatedQuestion.id = `${category.questions.indexOf(question)}`;
            // }

            // Handle either/or questions with sub-questions
            if (question.either && question.either.sub_questions) {
                updatedQuestion.either.sub_questions = question.either.sub_questions.map((subQ, index) => ({
                    ...subQ,
                    // id: `${question.either.id}_sub_${index}`,
                }));
            }

            if (question.or && question.or.sub_questions) {
                updatedQuestion.or.sub_questions = question.or.sub_questions.map((subQ, index) => ({
                    ...subQ,
                    // id: `${question.or.id}_sub_${index}`,
                }));
            }

            return updatedQuestion;
        });

        // Append the IDs of newly selected questions to updatedUserHistory
        const newQuestionIds = updatedQuestions.map((question) => question.id);
        updatedUserHistory.questionsJSON[categoryId] = [...new Set([...attemptedQuestionIds, ...newQuestionIds])];

        return { ...category, questions: updatedQuestions };
    });

    return {
        updatedUserHistory,
        categoriesWithQuestions: categoriesWithQuestions.filter((cat) => cat !== null),  // Remove nulls
    };
};

/*
- Retrieves previously attempted questions by the user
*/
const getAttemptedQuestions = async (userId, subjectName, educationLevel) => {
    const url = `http://localhost:${PORT_NO}/query/getQtnHistory/${userId}/${subjectName}/${educationLevel}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching user history:', error);
        return null; // or handle the error as you see fit
    }
}

/*
- Updates the previously attempted questions list with the current questions
*/
const updateQuestionHistory = async (selectedQuestionsJSON) => {
    // console.log('Selected Questions to Update: ', selectedQuestionsJSON)
    const url = `http://localhost:${PORT_NO}/query/updateQtnHistory/`;
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(selectedQuestionsJSON)
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // console.log('Response after updating question history: ', response);
        return await response.json(); // or just return true if the response doesn't include any data
    } catch (error) {
        console.error('Error updating question history:', error);
        return null; // or handle the error as you see fit
    }
}

/**
 * 
 * Check if is `EITHER` or `OR` type question
 */
const isEitherOrFormat = async (question) => {
    return question.hasOwnProperty('either') && question.hasOwnProperty('or');
};

/**
 * Send Email to guardian
*/
const sendEmailToNextOfKin = async (userInfo, subjectName, examScore, examDateTime) => {
    const studentName = `${userInfo.firstName} ${userInfo.lastName}${userInfo.otherName ? ` ${userInfo.otherName}` : ''}`;
    const educationLevel = userInfo.educationLevel;
    const kinNames = `${userInfo.kinFirstName} ${userInfo.kinLastName}`;
    const kinEmail = userInfo.kinEmail;

    // Send the information to the backend
    fetch(`http://localhost:${PORT_NO}/alert-guardian`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            studentName,
            educationLevel,
            kinNames,
            kinEmail,
            subjectName,
            examScore,
            examDateTime,
        }),
    })
        .then(response => {
            // console.log('Alerting Guardian: ', response);
            // Handle the response from the backend
            // ...
        })
        .catch(error => {
            console.error('Failed to send email notification', error);
        });
};

/**
 * Update user points
 */
// Save userPoints function (example)
const saveUserPointsToDatabase = async (points, userId) => {
    // Update points in the database
    try {
        let updatedPoints
        const response = await databases.listDocuments(database_id, pointsTable_id, [
            Query.equal("UserID", userId),
        ]);
        // console.log('Checking points table: ', response)
        if (response.documents.length > 0) { //TODO: If table user points doesn't exist, create new document
            const documentId = response.documents[0].$id //Points document id to be updated
            let currentPoints = response.documents[0].PointsBalance
            updatedPoints = currentPoints - points
            if (updatedPoints >= 0) {
                // console.log('points document id: ', documentId)

                //update Points table
                const updateResponse = await databases.updateDocument(database_id, pointsTable_id, documentId, { PointsBalance: updatedPoints })

                // console.log('Points updated: ', updateResponse);

                return updateResponse.PointsBalance
            }
        }

    } catch (error) {
        console.error("Error updating user points:", error);
        throw new Error("Error updating user points", error);
    }
};

// ==================== ROUTES =================
/**
 * Route to send exam data to client
 */
router.get("/fetch-exam", async (req, res) => {
    const { subjectName, userId, educationLevel } = req.query

    console.log("Request body: " + JSON.stringify(req.query));
    // Check if the passcode is correct
    if (!subjectName || !userId || !educationLevel) {
        return res.status(400).json({ message: "Exam processing failed. Missing required fields." });
    }

    try {
        const questionsData = await fetchQuestionsForSubject(subjectName);

        // console.log(questionsData);

        // Extract category IDs dynamically from questionsData
        const categoriesToInclude = questionsData.map(category => category.category);

        // Fetch the user's question history
        const userHistory = await getAttemptedQuestions(userId, subjectName, educationLevel);

        // Select random questions based on various parameters
        const randomQuestions = selectRandomQuestions(
            questionsData,
            categoriesToInclude,
            subjectName,
            userHistory,
            userId,
            educationLevel
        );

        // Sort questions by category
        randomQuestions.categoriesWithQuestions.sort((a, b) => a.category - b.category);

        // Update the question history with the new random questions
        await updateQuestionHistory(randomQuestions.updatedUserHistory);

        console.log("Sending back the generated exam: ", randomQuestions.categoriesWithQuestions);

        // Return the sorted random questions
        res.status(200).json({ questions: randomQuestions.categoriesWithQuestions, allQtns: questionsData });

    } catch (error) {
        console.log('Error fetching exam:', error);
        res.status(500).json({ message: "An error occurred while fetching the exam." });
    }

});

/**
 * Route submit exam to DB
 */
router.post('/submit', async (req, res) => {
    const { studID, subject, marks, dateTime, results, totalPossibleMarks, kinEmail, studInfo } = req.body;
    try {
        const userResultsData = {
            studID: studID,
            marks: marks,
            totalPossibleMarks: totalPossibleMarks ? totalPossibleMarks : null,
            subject: subject,
            results: results,
            dateTime: dateTime
        }

        //Save results to database
        console.log('Saving results to database');
        const result = await databases.createDocument(
            database_id,
            studentMarksTable_id,
            "unique()",
            userResultsData
        );

        //Send email to guardian if exists
        console.log('Sending email to guardian about student results');
        if (kinEmail) {
            await sendEmailToNextOfKin(studInfo, subject, marks, dateTime);
        }

        // Update user Points
        let points = await saveUserPointsToDatabase(1, studID);

        //Retrieve all student results
        let allResults = null;
        try {
            const response = await databases.listDocuments(
                database_id,
                studentMarksTable_id,
                [Query.equal("studID", studID), Query.limit(500)]
            );

            allResults = response.documents;
        } catch (e) {
            console.log('Failed to fetch all results from database', e);
        }

        //Respond back to client
        res.status(200).json({ allResults: allResults, points: points });

    } catch (err) {
        res.status(500).json({ message: 'Failed to save exam results data to database', error: error });
    }
});


export default router;
