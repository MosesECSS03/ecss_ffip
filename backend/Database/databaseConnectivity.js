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
            return document;
        } catch (error) {
            console.error('Error getting document:', error);
            throw error;
        }
    }

    async getDocuments(databaseName, collectionName, query = {}) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const documents = await collection.find(query).toArray();
            return documents;
        } catch (error) {
            console.error('Error getting documents:', error);
            throw error;
        }
    }

    async getDocumentById(databaseName, collectionName, id) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const document = await collection.findOne({ _id: new ObjectId(id) });
            return document;
        } catch (error) {
            console.error('Error getting document by ID:', error);
            throw error;
        }
    }

    async updateDocument(databaseName, collectionName, query, updateData) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const result = await collection.updateOne(query, updateData);
            
            return {
                success: result.matchedCount > 0,
                modifiedCount: result.modifiedCount,
                message: result.matchedCount > 0 ? 'Document updated successfully' : 'No document found to update'
            };
        } catch (error) {
            console.error('Error updating document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deleteDocument(databaseName, collectionName, query) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const result = await collection.deleteOne(query);
            
            return {
                success: result.deletedCount > 0,
                deletedCount: result.deletedCount,
                message: result.deletedCount > 0 ? 'Document deleted successfully' : 'No document found to delete'
            };
        } catch (error) {
            console.error('Error deleting document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deleteDocuments(databaseName, collectionName, query) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const result = await collection.deleteMany(query);
            
            return {
                success: result.deletedCount > 0,
                deletedCount: result.deletedCount,
                message: `${result.deletedCount} documents deleted successfully`
            };
        } catch (error) {
            console.error('Error deleting documents:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async countDocuments(databaseName, collectionName, query = {}) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const count = await collection.countDocuments(query);
            return count;
        } catch (error) {
            console.error('Error counting documents:', error);
            throw error;
        }
    }

    async aggregateDocuments(databaseName, collectionName, pipeline) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const result = await collection.aggregate(pipeline).toArray();
            return result;
        } catch (error) {
            console.error('Error aggregating documents:', error);
            throw error;
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