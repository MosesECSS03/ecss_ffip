const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://moseslee:Mlxy6695@ecss-course.hejib.mongodb.net/?retryWrites=true&w=majority&appName=ECSS-Course'; // Use env variable

class DatabaseConnectivity {
    constructor() {
        this.client = new MongoClient(uri);
        this.isConnected = false;
    }

    async initialize() {
        try {
            if (!this.isConnected) {
                await this.client.connect();
                this.isConnected = true;
                console.log('Database connected successfully');
            }
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    async insertDocument(databaseName, collectionName, document) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const result = await collection.insertOne(document);
            
            return {
                success: true,
                insertedId: result.insertedId,
                message: 'Document inserted successfully'
            };
        } catch (error) {
            console.error('Error inserting document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getDocument(databaseName, collectionName, query) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const document = await collection.findOne(query);
            if (!document) {
                return {
                    success: false,
                    message: 'No document found matching the query',
                    data: null
                };
            }
            return {
                success: true,
                message: 'Document retrieved successfully',
                data: document
            };
        } catch (error) {
            console.error('Error getting document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async disconnect() {
        try {
            await this.client.close();
            this.isConnected = false;
            console.log('Database disconnected successfully');
        } catch (error) {
            console.error('Error disconnecting from database:', error);
            throw error;
        }
    }
}

module.exports = DatabaseConnectivity;