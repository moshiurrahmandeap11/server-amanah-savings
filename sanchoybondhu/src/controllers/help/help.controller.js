// controllers/help/help.controller.js
import { db } from "../../database/db.js";
import { ObjectId } from "mongodb";

// Create a new help article
export const createArticle = async (req, res) => {
  try {
    const {
      articleId,
      icon,
      titleBn,
      titleEn,
      categoryBn,
      categoryEn,
      readTimeBn,
      readTimeEn,
      bodyBn,
      bodyEn,
      tags,
      isPopular,
    } = req.body;

    if (!articleId || !titleBn || !titleEn || !bodyBn || !bodyEn) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const articlesCollection = db.collection("help_articles");

    // Check if article already exists
    const existingArticle = await articlesCollection.findOne({ articleId });
    if (existingArticle) {
      return res.status(400).json({
        success: false,
        message: "Article with this ID already exists",
      });
    }

    const article = {
      articleId,
      icon: icon || "📄",
      title: { bn: titleBn, en: titleEn },
      category: { bn: categoryBn || "সাধারণ", en: categoryEn || "General" },
      readTime: { bn: readTimeBn || "২ মিনিট পড়া", en: readTimeEn || "2 min read" },
      body: { bn: bodyBn, en: bodyEn },
      tags: tags || [],
      isPopular: isPopular || false,
      views: 0,
      helpful: 0,
      notHelpful: 0,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await articlesCollection.insertOne(article);

    return res.status(201).json({
      success: true,
      message: "Article created successfully",
      data: { ...article, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Create article error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create article",
    });
  }
};

// Get all help articles
export const getAllArticles = async (req, res) => {
  try {
    const { category, search, popular, page = 1, limit = 20 } = req.query;

    const articlesCollection = db.collection("help_articles");
    
    const query = { status: "published" };
    if (category && category !== "all") {
      query["category.en"] = category;
    }
    if (popular === "true") {
      query.isPopular = true;
    }
    if (search) {
      query.$or = [
        { "title.en": { $regex: search, $options: "i" } },
        { "title.bn": { $regex: search, $options: "i" } },
        { "body.en": { $regex: search, $options: "i" } },
        { "body.bn": { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const articles = await articlesCollection
      .find(query)
      .sort({ isPopular: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await articlesCollection.countDocuments(query);

    // Get categories with counts
    const categories = await articlesCollection.aggregate([
      { $match: { status: "published" } },
      {
        $group: {
          _id: "$category.en",
          count: { $sum: 1 },
          icon: { $first: "$icon" },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: {
        articles,
        categories,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get all articles error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch articles",
    });
  }
};

// Get single article by ID
export const getArticleById = async (req, res) => {
  try {
    const { articleId } = req.params;

    const articlesCollection = db.collection("help_articles");
    
    const article = await articlesCollection.findOne({ articleId });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // Increment view count
    await articlesCollection.updateOne(
      { articleId },
      { $inc: { views: 1 } }
    );

    return res.status(200).json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error("Get article error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch article",
    });
  }
};

// Update article
export const updateArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const updateData = req.body;

    const articlesCollection = db.collection("help_articles");
    
    const article = await articlesCollection.findOne({ articleId });
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    const updatedArticle = {
      updatedAt: new Date(),
    };

    if (updateData.icon) updatedArticle.icon = updateData.icon;
    if (updateData.titleBn || updateData.titleEn) {
      updatedArticle.title = {
        bn: updateData.titleBn || article.title.bn,
        en: updateData.titleEn || article.title.en,
      };
    }
    if (updateData.categoryBn || updateData.categoryEn) {
      updatedArticle.category = {
        bn: updateData.categoryBn || article.category.bn,
        en: updateData.categoryEn || article.category.en,
      };
    }
    if (updateData.readTimeBn || updateData.readTimeEn) {
      updatedArticle.readTime = {
        bn: updateData.readTimeBn || article.readTime.bn,
        en: updateData.readTimeEn || article.readTime.en,
      };
    }
    if (updateData.bodyBn || updateData.bodyEn) {
      updatedArticle.body = {
        bn: updateData.bodyBn || article.body.bn,
        en: updateData.bodyEn || article.body.en,
      };
    }
    if (updateData.tags) updatedArticle.tags = updateData.tags;
    if (updateData.isPopular !== undefined) updatedArticle.isPopular = updateData.isPopular;
    if (updateData.status) updatedArticle.status = updateData.status;

    const result = await articlesCollection.updateOne(
      { articleId },
      { $set: updatedArticle }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes made",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Article updated successfully",
    });
  } catch (error) {
    console.error("Update article error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update article",
    });
  }
};

// Delete article
export const deleteArticle = async (req, res) => {
  try {
    const { articleId } = req.params;

    const articlesCollection = db.collection("help_articles");
    
    const result = await articlesCollection.deleteOne({ articleId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    console.error("Delete article error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete article",
    });
  }
};

// Submit feedback on article
export const submitFeedback = async (req, res) => {
  try {
    const { articleId } = req.params;
    const { helpful } = req.body;
    const userId = req.user?._id;

    const articlesCollection = db.collection("help_articles");
    const feedbackCollection = db.collection("article_feedback");

    const article = await articlesCollection.findOne({ articleId });
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // Check if user already gave feedback
    if (userId) {
      const existingFeedback = await feedbackCollection.findOne({
        articleId,
        userId: new ObjectId(userId),
      });

      if (existingFeedback) {
        return res.status(400).json({
          success: false,
          message: "You have already provided feedback for this article",
        });
      }
    }

    // Save feedback
    await feedbackCollection.insertOne({
      articleId,
      userId: userId ? new ObjectId(userId) : null,
      helpful,
      createdAt: new Date(),
    });

    // Update article counts
    if (helpful) {
      await articlesCollection.updateOne(
        { articleId },
        { $inc: { helpful: 1 } }
      );
    } else {
      await articlesCollection.updateOne(
        { articleId },
        { $inc: { notHelpful: 1 } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Thank you for your feedback!",
    });
  } catch (error) {
    console.error("Submit feedback error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit feedback",
    });
  }
};

// Get article categories with counts
export const getCategories = async (req, res) => {
  try {
    const articlesCollection = db.collection("help_articles");
    
    const categories = await articlesCollection.aggregate([
      { $match: { status: "published" } },
      {
        $group: {
          _id: "$category.en",
          nameBn: { $first: "$category.bn" },
          nameEn: { $first: "$category.en" },
          count: { $sum: 1 },
          icon: { $first: "$icon" },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray();

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch categories",
    });
  }
};

// Search articles
export const searchArticles = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const articlesCollection = db.collection("help_articles");
    
    const articles = await articlesCollection
      .find({
        status: "published",
        $or: [
          { "title.en": { $regex: q, $options: "i" } },
          { "title.bn": { $regex: q, $options: "i" } },
          { "body.en": { $regex: q, $options: "i" } },
          { "body.bn": { $regex: q, $options: "i" } },
          { tags: { $in: [new RegExp(q, "i")] } },
        ],
      })
      .sort({ isPopular: -1, views: -1 })
      .limit(parseInt(limit))
      .toArray();

    return res.status(200).json({
      success: true,
      data: articles,
      count: articles.length,
    });
  } catch (error) {
    console.error("Search articles error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to search articles",
    });
  }
};

// Get popular articles
export const getPopularArticles = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const articlesCollection = db.collection("help_articles");
    
    const articles = await articlesCollection
      .find({ status: "published", isPopular: true })
      .sort({ views: -1, helpful: -1 })
      .limit(parseInt(limit))
      .toArray();

    return res.status(200).json({
      success: true,
      data: articles,
    });
  } catch (error) {
    console.error("Get popular articles error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch popular articles",
    });
  }
};

// Create support ticket
export const createSupportTicket = async (req, res) => {
  try {
    const userId = req.user?._id;
    const {
      subject,
      message,
      category,
      priority = "medium",
      attachments,
    } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    const ticketsCollection = db.collection("support_tickets");
    
    const ticket = {
      userId: userId ? new ObjectId(userId) : null,
      ticketId: `TKT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      subject,
      message,
      category: category || "general",
      priority,
      status: "open",
      attachments: attachments || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await ticketsCollection.insertOne(ticket);

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data: { ...ticket, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Create ticket error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create support ticket",
    });
  }
};

// Get user's support tickets
export const getUserTickets = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const ticketsCollection = db.collection("support_tickets");
    
    const query = { userId: new ObjectId(userId) };
    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const tickets = await ticketsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await ticketsCollection.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get user tickets error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch tickets",
    });
  }
};

// Get single support ticket
export const getTicketById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { ticketId } = req.params;

    const ticketsCollection = db.collection("support_tickets");
    const repliesCollection = db.collection("ticket_replies");

    const ticket = await ticketsCollection.findOne({
      ticketId,
      userId: new ObjectId(userId),
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    const replies = await repliesCollection
      .find({ ticketId })
      .sort({ createdAt: 1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: { ticket, replies },
    });
  } catch (error) {
    console.error("Get ticket error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch ticket",
    });
  }
};

// Reply to support ticket
export const replyToTicket = async (req, res) => {
  try {
    const userId = req.user._id;
    const { ticketId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const ticketsCollection = db.collection("support_tickets");
    const repliesCollection = db.collection("ticket_replies");

    const ticket = await ticketsCollection.findOne({
      ticketId,
      userId: new ObjectId(userId),
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    const reply = {
      ticketId,
      userId: new ObjectId(userId),
      message,
      isAdmin: false,
      createdAt: new Date(),
    };

    await repliesCollection.insertOne(reply);

    // Update ticket status
    await ticketsCollection.updateOne(
      { ticketId },
      {
        $set: {
          status: ticket.status === "closed" ? "reopened" : "open",
          updatedAt: new Date(),
        },
      }
    );

    // Emit real-time ticket reply to admins
    const { emitNewTicket } = await import("../../socket/socket.js");
    emitNewTicket({ ticketId, reply, userId: userId.toString(), updatedAt: new Date() });

    return res.status(200).json({
      success: true,
      message: "Reply added successfully",
    });
  } catch (error) {
    console.error("Reply to ticket error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add reply",
    });
  }
};

// Admin: Get all support tickets
export const getAllSupportTickets = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;

    const ticketsCollection = db.collection("support_tickets");
    
    const query = {};
    if (status && status !== "all") query.status = status;
    if (priority && priority !== "all") query.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const tickets = await ticketsCollection
      .aggregate([
        { $match: query },
        { $sort: { priority: 1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $project: {
            _id: 1,
            ticketId: 1,
            subject: 1,
            category: 1,
            priority: 1,
            status: 1,
            createdAt: 1,
            "user.fullName": 1,
            "user.phone": 1,
            "user.email": 1,
          },
        },
      ])
      .toArray();

    const total = await ticketsCollection.countDocuments(query);

    const statistics = await ticketsCollection.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    const stats = {
      open: statistics.find(s => s._id === "open")?.count || 0,
      inProgress: statistics.find(s => s._id === "in_progress")?.count || 0,
      resolved: statistics.find(s => s._id === "resolved")?.count || 0,
      closed: statistics.find(s => s._id === "closed")?.count || 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        statistics: stats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get all tickets error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch tickets",
    });
  }
};

// Admin: Update ticket status
export const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, adminNote } = req.body;

    if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const ticketsCollection = db.collection("support_tickets");
    
    const result = await ticketsCollection.updateOne(
      { ticketId },
      {
        $set: {
          status,
          adminNote: adminNote || null,
          updatedAt: new Date(),
          ...(status === "resolved" && { resolvedAt: new Date() }),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Ticket status updated to ${status}`,
    });
  } catch (error) {
    console.error("Update ticket status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update ticket status",
    });
  }
};

// Get help statistics
export const getHelpStatistics = async (req, res) => {
  try {
    const articlesCollection = db.collection("help_articles");
    const ticketsCollection = db.collection("support_tickets");
    const feedbackCollection = db.collection("article_feedback");

    const totalArticles = await articlesCollection.countDocuments({ status: "published" });
    const totalViews = await articlesCollection.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: null, total: { $sum: "$views" } } },
    ]).toArray();
    
    const totalHelpful = await articlesCollection.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: null, total: { $sum: "$helpful" } } },
    ]).toArray();
    
    const openTickets = await ticketsCollection.countDocuments({ status: { $in: ["open", "in_progress"] } });
    const avgResponseTime = 2.5; // hours, can be calculated from actual data

    return res.status(200).json({
      success: true,
      data: {
        totalArticles,
        totalViews: totalViews[0]?.total || 0,
        totalHelpful: totalHelpful[0]?.total || 0,
        openTickets,
        avgResponseTime,
      },
    });
  } catch (error) {
    console.error("Get help statistics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch statistics",
    });
  }
};