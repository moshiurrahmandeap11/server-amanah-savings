// middlewares/verifyAdmin.js
import jwt from "jsonwebtoken";
import { db } from "../database/db.js";
import { ObjectId } from "mongodb";

const verifyAdmin = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(403).json({
            success: false,
            message: "No token provided, access denied"
        });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({
            success: false,
            message: "Invalid token format, use <Bearer> format"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = {
            _id: decoded._id || decoded.id || decoded.userId,
            id: decoded.id || decoded._id || decoded.userId,
            ...decoded
        };

        // Check if user has admin role
        const usersCollection = db.collection("users");
        const user = await usersCollection.findOne(
            { _id: new ObjectId(req.user._id) },
            { projection: { role: 1, firstName: 1, email: 1 } }
        );

        if (!user || user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required. You do not have permission to access this resource."
            });
        }

        req.user.role = user.role;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token, authorization failed"
        });
    }
};

export default verifyAdmin;