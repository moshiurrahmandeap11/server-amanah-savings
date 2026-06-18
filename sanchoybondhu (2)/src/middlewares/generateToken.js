import jwt from "jsonwebtoken";

const generateToken = (user) => {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: "3d"});

    return token;
}

export default generateToken;