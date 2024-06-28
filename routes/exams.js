import express from "express";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { constants as fsConstants } from "fs";
import path from "path";
import dotenv from "dotenv";
import { promisify } from "util";
import { fileURLToPath } from "url";
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
import { eng_ple } from "../questions/questionsData.js"

dotenv.config();

const router = express.Router();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const examCountersFilePath = path.join(dirname, '..', 'data', 'exam_creation_counter.json');

// ==================== FUNCTIONS ====================
const fetchQuestionsForSubject = async (subject) => {
    try {
        console.log("Determining subject...");
        let collection_id;
        let questions = []
        let questionData = []

        if (subject === 'english-language_ple') { //Fetched from server
            questions = eng_ple;

            questionData = questions;
        }
        else { //Fetched from Appwrite database
            switch (subject) {
                case "social-studies_ple":
                    collection_id = sstTablePLE_id;
                    break;
                case "mathematics_ple":
                    collection_id = mathPLE_id;
                    break;
                // case "english-language_ple":
                // collection_id = engTbalePLE_id;
                // break;
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
                [Query.limit(200), Query.orderAsc("$id")]
            );

            questions = response.documents;

            questionData = questions;

            questionData.forEach((obj) => {
                obj.questions = obj.questions.map((q) => JSON.parse(q));
                delete obj.$createdAt;
                delete obj.$updatedAt;
                delete obj.$permissions;
                delete obj.$databaseId;
                delete obj.$collectionId;
            });

        }

        console.log("Finished fetching question data: ");
        return questionData;
    } catch (error) {
        console.error("Error fetching data:", error);
        throw error;
    }
};

const selectRandomQuestions = async (subjectName, questionsData, categoryIds, collection_id, qtnHistory) => {
    console.log('Subject: ', subjectName);
    let updatedQtnHistory = {
        collection_id,
        questionsJSON: { ...qtnHistory?.questionsJSON },
    };

    const getNumQuestions = (subjectName, categoryId) => {
        if (subjectName === 'social-studies_ple') {
            if ([36, 51].includes(categoryId)) return 5;
        }
        if (subjectName === 'english-language_ple') {
            if (categoryId === 31) return 20;
            if (categoryId === 6) return 10;
            if (categoryId === 1) return 5;
            if (categoryId === 18) return 3;
            if ([16, 21, 23, 25, 27, 29].includes(categoryId)) return 2;
            if ([51, 52, 53, 54, 55].includes(categoryId)) return 1;
        }
        return 1;
    };

    // const updateQuestionIds = (questions, prefix) => {
    //     return questions.map((question, index) => {
    //         const updatedQuestion = { ...question, id: `${prefix}_${index}` };
    //         if (question.either?.sub_questions) {
    //             updatedQuestion.either.sub_questions = question.either.sub_questions.map((subQ, subIndex) => ({
    //                 ...subQ,
    //                 id: `${question.either.id}_sub_${subIndex}`
    //             }));
    //         }
    //         if (question.or?.sub_questions) {
    //             updatedQuestion.or.sub_questions = question.or.sub_questions.map((subQ, subIndex) => ({
    //                 ...subQ,
    //                 id: `${question.or.id}_sub_${subIndex}`
    //             }));
    //         }
    //         return updatedQuestion;
    //     });
    // };
    const updateQuestionIds = (questions, prefix) => {
        return questions.map((question, index) => {
            const updatedQuestion = {
                ...question,
                id: question.id ?? `${prefix}_${index}`
            };

            if (question.either?.sub_questions) {
                updatedQuestion.either.sub_questions = question.either.sub_questions.map((subQ, subIndex) => ({
                    ...subQ,
                    id: subQ.id ?? `${question.either.id}_sub_${subIndex}`
                }));
            }

            if (question.or?.sub_questions) {
                updatedQuestion.or.sub_questions = question.or.sub_questions.map((subQ, subIndex) => ({
                    ...subQ,
                    id: subQ.id ?? `${question.or.id}_sub_${subIndex}`
                }));
            }

            return updatedQuestion;
        });
    };

    const selectQuestionsForCategory = async (categoryId) => {
        const category = questionsData.find((cat) => cat.category === categoryId);
        if (!category) {
            console.log(`Category ${categoryId} not found`);
            return null;
        }

        let attemptedQuestionIds = qtnHistory?.questionsJSON?.[categoryId] || [];
        const allQuestionIds = category.questions.map((question) => question.id);

        if (attemptedQuestionIds.length >= allQuestionIds.length) {
            // console.log('Resetting attempted questions to empty array');
            attemptedQuestionIds = [];
            updatedQtnHistory.questionsJSON[categoryId] = [];
        }

        let availableQuestions = category.questions.filter((question) => !attemptedQuestionIds.includes(question.id));
        const numQuestions = getNumQuestions(subjectName, categoryId);

        if (availableQuestions.length < numQuestions) {
            attemptedQuestionIds = [];
            availableQuestions = category.questions;
        }

        let selectedQuestions = [...availableQuestions].sort(() => 0.5 - Math.random()).slice(0, numQuestions);

        if (selectedQuestions.length < numQuestions) {
            const additionalQuestions = attemptedQuestionIds.splice(0, numQuestions - selectedQuestions.length)
                .map((id) => category.questions.find((q) => q.id === id))
                .filter(Boolean);

            selectedQuestions = selectedQuestions.concat(additionalQuestions);

            if (attemptedQuestionIds.length === 0) {
                updatedQtnHistory.questionsJSON[categoryId] = [];
            }
        }

        const updatedQuestions = updateQuestionIds(selectedQuestions, categoryId);

        const newQuestionIds = updatedQuestions.map((question) => question.id);
        updatedQtnHistory.questionsJSON[categoryId] = [...new Set([...attemptedQuestionIds, ...newQuestionIds])];

        return { ...category, questions: updatedQuestions };
    };

    const categoriesWithQuestions = await Promise.all(categoryIds.map(selectQuestionsForCategory));

    return {
        updatedQtnHistory,
        categoriesWithQuestions: categoriesWithQuestions.filter((cat) => cat !== null),
    };
};

// Retrieve User Questions History
const getAttemptedQuestions = async (userId, subjectName) => {
    let fileName = 'attemptedQuestionHistory.json';
    if (subjectName && userId) {
        const filePath = path.join(dirname, "..", "data", fileName);

        try {
            const data = await readFile(filePath, "utf8");
            const records = JSON.parse(data);

            const userRecord = records.find(
                (record) =>
                    record.userId === userId && record.SubjectName === subjectName,
            );

            if (userRecord) {
                return {
                    questionsJSON: userRecord.questionsJSON || {},
                    timestamp: userRecord.Timestamp || null,
                };
            } else {
                return { questionsJSON: {}, timestamp: null };
            }
        } catch (error) {
            console.error(error);
            throw new Error(`Error Fetching ${subjectName} exam history: ${error}`);
        }
    } else {
        throw new Error("One of the parameters is not provided");
    }
};

// Update User Questions History
const updateQuestionHistory = async (questionsJSON, subjectName, userId) => {
    // console.log('updatedQtnHistory: ', questionsJSON);
    let fileName = 'attemptedQuestionHistory.json';
    const filePath = path.join(dirname, "..", "data", fileName);

    try {
        let fileExists = true;
        try {
            await fsPromises.access(filePath, fsConstants.F_OK);
            console.log("File exists");
        } catch (error) {
            fileExists = false;
            console.log("File does not exist");
        }

        let records;

        if (fileExists) {
            const data = await fsPromises.readFile(filePath, "utf8");
            records = JSON.parse(data);
        } else {
            records = [];
        }

        const existingRecordIndex = records.findIndex(
            (record) =>
                record.SubjectName === subjectName && record.userId === userId,
        );

        if (existingRecordIndex >= 0) {

            records[existingRecordIndex] = {
                userId: userId,
                SubjectName: subjectName,
                questionsJSON: questionsJSON,
                Timestamp: new Date().toISOString(),
            };
        } else {
            records.push({
                userId: userId,
                SubjectName: subjectName,
                questionsJSON: questionsJSON,
                Timestamp: new Date().toISOString(),
            });
            console.log("Appending new exam record.");
        }

        const validJSON = JSON.stringify(records, null, 2);

        await fsPromises.writeFile(filePath, validJSON);

        return {
            updated: `Updated ${subjectName} exam history successfully`,
        };
    } catch (error) {
        console.error(`Error Updating ${subjectName} exam history: ${error}`);
        throw new Error(`Error Updating ${subjectName} exam history: ${error}`);
    }
};

// Function to read exam counters from the JSON file
const readCounters = async () => {
    if (!fs.existsSync(examCountersFilePath)) {
        fs.writeFileSync(examCountersFilePath, JSON.stringify({ studentCounter: 0, adminCounter: 0 }));
    }
    const counters = fs.readFileSync(examCountersFilePath, 'utf8');
    return JSON.parse(counters);
};

//Function to write exam counters to the JSON file
const writeCounters = async (counters) => {
    fs.writeFileSync(examCountersFilePath, JSON.stringify(counters, null, 2));
};

// Function to generate exam ID
const generateExamID = (counter) => {
    return `EXM${String(counter).padStart(3, '0')}`;
}

// ==================== ROUTES =================
router.get("/fetch-exam", async (req, res) => {
    const { userId, subjectName } = req.query;

    console.log('subject name: ', subjectName);

    console.log("Request body: " + JSON.stringify(req.query));
    if (userId === null || subjectName === null || subjectName === undefined) {
        return res.status(400).json({ message: `Exam processing failed. Missing a required value, userId or subjectName.` });
    }

    try {
        const questionsData = await fetchQuestionsForSubject(subjectName);

        // console.log(questionsData);
        // res.status(200).json({ questions: questionsData });

        const categoriesToInclude = questionsData.map(category => category.category);

        const qtnHistory = await getAttemptedQuestions(userId, subjectName);

        const randomQuestions = await selectRandomQuestions(
            subjectName,
            questionsData,
            categoriesToInclude,
            userId,
            qtnHistory,
        );

        randomQuestions.categoriesWithQuestions.sort((a, b) => a.category - b.category);

        await updateQuestionHistory(randomQuestions.updatedQtnHistory.questionsJSON, subjectName, userId);

        //Generate Exam ID
        let counters = await readCounters();

        counters.examCounter += 1;

        const counter = counters.examCounter

        const examID = generateExamID(counter)

        //Update the exam counter json file
        await writeCounters(counters);

        res.status(200).json({ allquestions: questionsData, questions: randomQuestions.categoriesWithQuestions, examID: examID });

    } catch (error) {
        console.log('Error fetching exam:', error);
        res.status(500).json({ message: "An error occurred while fetching the exam." });
    }
});

export default router;
