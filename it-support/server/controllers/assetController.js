/**
 * Asset Controller — IT asset management endpoints.
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import { Op } from 'sequelize';
import {
  Asset,
  AssetCategory,
  AssetAssignment,
  MaintenanceLog,
  User,
  sequelize,
} from '../models/index.js';
import { recordActivity } from '../utils/activityTracker.js';

const ASSET_STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'RETIRED', 'LOST'];
const ASSET_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'BROKEN'];

// ───── helpers ─────
const isPrivileged = (role) =>
  ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'].includes(role);

const isManager = (role) => ['ADMIN', 'SUPER_ADMIN'].includes(role);

// ─────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────
export const getCategories = async (req, res) => {
  try {
    const categories = await AssetCategory.findAll({
      where: { companyId: req.user.companyId },
      order: [['name', 'ASC']],
    });
    return res.json(categories);
  } catch (err) {
    console.error('[getCategories]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, nameAr, icon, description } = req.body;
    if (!name) return res.status(400).json({ message: 'الاسم مطلوب.' });

    const category = await AssetCategory.create({
      companyId: req.user.companyId,
      name,
      nameAr: nameAr || null,
      icon: icon || null,
      description: description || null,
    });
    return res.status(201).json(category);
  } catch (err) {
    console.error('[createCategory]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const cat = await AssetCategory.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!cat) return res.status(404).json({ message: 'التصنيف غير موجود.' });

    const { name, nameAr, icon, description } = req.body;
    if (name !== undefined) cat.name = name;
    if (nameAr !== undefined) cat.nameAr = nameAr;
    if (icon !== undefined) cat.icon = icon;
    if (description !== undefined) cat.description = description;
    await cat.save();
    return res.json(cat);
  } catch (err) {
    console.error('[updateCategory]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const cat = await AssetCategory.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!cat) return res.status(404).json({ message: 'التصنيف غير موجود.' });

    const inUse = await Asset.count({ where: { categoryId: cat.id } });
    if (inUse > 0) {
      return res.status(400).json({
        message: `لا يمكن حذف هذا التصنيف — مرتبط بـ ${inUse} أصل.`,
      });
    }
    await cat.destroy();
    return res.json({ message: 'تم الحذف.' });
  } catch (err) {
    console.error('[deleteCategory]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// ASSETS — list / create / read / update / delete
// ─────────────────────────────────────────────────────────────────
export const getAssets = async (req, res) => {
  try {
    // Authorization handled by route middleware (canReadAssets).
    const { status, categoryId, search, page = 1, limit = 50 } = req.query;
    const where = { companyId: req.user.companyId };
    if (status && ASSET_STATUSES.includes(status)) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where[Op.or] = [
        { assetTag: { [Op.like]: `%${search}%` } },
        { brand: { [Op.like]: `%${search}%` } },
        { model: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { count, rows } = await Asset.findAndCountAll({
      where,
      include: [
        { model: AssetCategory, as: 'Category' },
        { model: User, as: 'CurrentUser', attributes: ['id', 'name', 'email', 'department'] },
        {
          model: AssetAssignment,
          required: false,
          where: { returnedAt: null },
          include: [
            { model: User, as: 'AssignedByUser', attributes: ['id', 'name'] },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit, 10),
      distinct: true,
    });

    return res.json({ total: count, page: parseInt(page, 10), assets: rows });
  } catch (err) {
    console.error('[getAssets]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

// IT/Admin can view assets of any employee
export const getAssetsByUser = async (req, res) => {
  try {
    // Authorization handled by route middleware.
    const userId = req.params.userId;
    const user = await User.findOne({
      where: { id: userId, companyId: req.user.companyId },
      attributes: ['id', 'name', 'email', 'department', 'role'],
    });
    if (!user) return res.status(404).json({ message: 'الموظف غير موجود.' });

    const [currentAssets, history] = await Promise.all([
      Asset.findAll({
        where: { currentUserId: userId, companyId: req.user.companyId },
        include: [{ model: AssetCategory, as: 'Category' }],
        order: [['createdAt', 'DESC']],
      }),
      AssetAssignment.findAll({
        where: { userId },
        include: [
          { model: Asset, attributes: ['id', 'assetTag', 'brand', 'model', 'status'] },
          { model: User, as: 'AssignedByUser', attributes: ['id', 'name'] },
        ],
        order: [['assignedAt', 'DESC']],
        limit: 100,
      }),
    ]);

    return res.json({ user, currentAssets, history });
  } catch (err) {
    console.error('[getAssetsByUser]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const getMyAssets = async (req, res) => {
  try {
    const assets = await Asset.findAll({
      where: { currentUserId: req.user.id, companyId: req.user.companyId },
      include: [
        { model: AssetCategory, as: 'Category' },
        {
          model: AssetAssignment,
          required: false,
          where: { returnedAt: null },
          include: [
            { model: User, as: 'AssignedByUser', attributes: ['id', 'name'] },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json(assets);
  } catch (err) {
    console.error('[getMyAssets]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
      include: [
        { model: AssetCategory, as: 'Category' },
        { model: User, as: 'CurrentUser', attributes: ['id', 'name', 'email', 'department'] },
      ],
    });
    if (!asset) return res.status(404).json({ message: 'الأصل غير موجود.' });

    // Employees can only view their own assets
    if (!isPrivileged(req.user.role) && asset.currentUserId !== req.user.id) {
      return res.status(403).json({ message: 'غير مصرّح.' });
    }

    const [history, maintenance] = await Promise.all([
      AssetAssignment.findAll({
        where: { assetId: asset.id },
        include: [
          { model: User, as: 'Holder', attributes: ['id', 'name', 'email'] },
          { model: User, as: 'AssignedByUser', attributes: ['id', 'name'] },
        ],
        order: [['assignedAt', 'DESC']],
      }),
      MaintenanceLog.findAll({
        where: { assetId: asset.id },
        include: [{ model: User, as: 'Technician', attributes: ['id', 'name'] }],
        order: [['performedAt', 'DESC']],
      }),
    ]);

    return res.json({ asset, history, maintenance });
  } catch (err) {
    console.error('[getAssetById]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const createAsset = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Authorization handled by route middleware (requirePermission ASSET_CREATE).
    const {
      assetTag, categoryId, brand, model, serialNumber,
      purchaseDate, purchasePrice, vendor, invoiceNumber,
      warrantyExpiry, status, condition, location, notes, imageUrl,
      currentUserId, specifications, assignmentDate, odooNumber,
      deviceColor, invoiceFile,
    } = req.body;

    if (!assetTag) {
      await t.rollback();
      return res.status(400).json({ message: 'رقم العهده مطلوب.' });
    }

    const existing = await Asset.findOne({
      where: { assetTag, companyId: req.user.companyId },
      paranoid: false,
      transaction: t,
    });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: 'رقم العهده مستخدم بالفعل.' });
    }

    // Prevent duplicate Serial Number (only when one is provided)
    if (serialNumber && serialNumber.trim()) {
      const dupSn = await Asset.findOne({
        where: { serialNumber: serialNumber.trim(), companyId: req.user.companyId },
        paranoid: false,
        transaction: t,
      });
      if (dupSn) {
        await t.rollback();
        return res.status(400).json({ message: `الرقم التسلسلي مستخدم بالفعل في الأصل ${dupSn.assetTag}.` });
      }
    }

    // Prevent duplicate Odoo Number (only when one is provided)
    if (odooNumber && odooNumber.trim()) {
      const dupOdoo = await Asset.findOne({
        where: { odooNumber: odooNumber.trim(), companyId: req.user.companyId },
        paranoid: false,
        transaction: t,
      });
      if (dupOdoo) {
        await t.rollback();
        return res.status(400).json({ message: `رقم اودو مستخدم بالفعل في الأصل ${dupOdoo.assetTag}.` });
      }
    }

    let assignedUser = null;
    if (currentUserId) {
      assignedUser = await User.findOne({
        where: { id: currentUserId, companyId: req.user.companyId },
        transaction: t,
      });
      if (!assignedUser) {
        await t.rollback();
        return res.status(400).json({ message: 'الموظف المختار غير موجود.' });
      }
    }

    const finalStatus = assignedUser
      ? 'ASSIGNED'
      : (status && ASSET_STATUSES.includes(status) ? status : 'AVAILABLE');

    const asset = await Asset.create({
      companyId: req.user.companyId,
      assetTag,
      categoryId: categoryId || null,
      brand: brand || null,
      model: model || null,
      serialNumber: serialNumber || null,
      purchaseDate: purchaseDate || null,
      purchasePrice: purchasePrice || null,
      vendor: vendor || null,
      invoiceNumber: invoiceNumber || null,
      warrantyExpiry: warrantyExpiry || null,
      status: finalStatus,
      condition: condition && ASSET_CONDITIONS.includes(condition) ? condition : 'GOOD',
      location: location || null,
      specifications: specifications || null,
      odooNumber: odooNumber || null,
      deviceColor: deviceColor || null,
      invoiceFile: invoiceFile || null,
      assignmentDate: assignedUser && assignmentDate ? assignmentDate : null,
      notes: notes || null,
      imageUrl: imageUrl || null,
      currentUserId: assignedUser ? assignedUser.id : null,
    }, { transaction: t });

    if (assignedUser) {
      await AssetAssignment.create({
        assetId: asset.id,
        userId: assignedUser.id,
        assignedBy: req.user.id,
        assignedAt: assignmentDate ? new Date(assignmentDate) : new Date(),
        conditionOnAssignment: asset.condition || 'GOOD',
        notes: 'تم التسليم عند إنشاء الأصل',
      }, { transaction: t });
    }

    await t.commit();
    recordActivity(req, 'asset.create', {
      targetId: asset.id,
      targetName: `العهدة ${asset.assetTag}`,
      details: assignedUser ? `سُلِّمت لـ ${assignedUser.name}` : 'بدون تسليم',
    });
    return res.status(201).json(asset);
  } catch (err) {
    await t.rollback();
    console.error('[createAsset]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const updateAsset = async (req, res) => {
  try {
    // Authorization handled by route middleware (requirePermission ASSET_EDIT).
    const asset = await Asset.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!asset) return res.status(404).json({ message: 'الأصل غير موجود.' });

    // Duplicate-prevention checks for the unique-ish fields.
    // For each field: only check if the value is changing AND non-empty.
    const checkDup = async (field, value, label) => {
      if (!value || !value.trim()) return null;
      const trimmed = value.trim();
      if (asset[field] === trimmed) return null;
      const dup = await Asset.findOne({
        where: { [field]: trimmed, companyId: req.user.companyId },
        paranoid: false,
      });
      if (dup && dup.id !== asset.id) {
        return `${label} مستخدم بالفعل في الأصل ${dup.assetTag}.`;
      }
      return null;
    };

    const errAssetTag = await checkDup('assetTag', req.body.assetTag, 'رقم العهده');
    if (errAssetTag) return res.status(400).json({ message: errAssetTag });
    const errSn = await checkDup('serialNumber', req.body.serialNumber, 'الرقم التسلسلي');
    if (errSn) return res.status(400).json({ message: errSn });
    const errOdoo = await checkDup('odooNumber', req.body.odooNumber, 'رقم اودو');
    if (errOdoo) return res.status(400).json({ message: errOdoo });

    const allowed = [
      'assetTag', 'categoryId', 'brand', 'model', 'serialNumber',
      'purchaseDate', 'purchasePrice', 'vendor', 'invoiceNumber',
      'warrantyExpiry', 'status', 'condition', 'location', 'notes', 'imageUrl',
      'specifications', 'assignmentDate', 'odooNumber',
      'deviceColor', 'invoiceFile',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'status' && !ASSET_STATUSES.includes(req.body[key])) continue;
        if (key === 'condition' && !ASSET_CONDITIONS.includes(req.body[key])) continue;
        asset[key] = req.body[key];
      }
    }
    await asset.save();
    recordActivity(req, 'asset.update', {
      targetId: asset.id,
      targetName: `العهدة ${asset.assetTag}`,
    });
    return res.json(asset);
  } catch (err) {
    console.error('[updateAsset]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const deleteAsset = async (req, res) => {
  try {
    // Authorization handled by route middleware (requirePermission ASSET_DELETE).
    const asset = await Asset.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!asset) return res.status(404).json({ message: 'الأصل غير موجود.' });

    asset.deletedBy = req.user.id;
    asset.deletedByName = req.user.name;
    asset.deletionReason = req.body.reason || null;
    await asset.save();
    await asset.destroy();
    recordActivity(req, 'asset.delete', {
      targetId: asset.id,
      targetName: `العهدة ${asset.assetTag}`,
      details: req.body.reason || 'بدون سبب',
    });
    return res.json({ message: 'تم الحذف.' });
  } catch (err) {
    console.error('[deleteAsset]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// ASSIGNMENTS — assign / return
// ─────────────────────────────────────────────────────────────────
export const assignAsset = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Authorization handled by route middleware (requirePermission ASSET_ASSIGN).
    const { userId, conditionOnAssignment, notes, signature } = req.body;
    if (!userId) {
      await t.rollback();
      return res.status(400).json({ message: 'الموظف مطلوب.' });
    }

    const asset = await Asset.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
      transaction: t,
    });
    if (!asset) {
      await t.rollback();
      return res.status(404).json({ message: 'الأصل غير موجود.' });
    }

    if (asset.currentUserId) {
      await t.rollback();
      return res.status(400).json({
        message: 'هذا الأصل مخصّص لموظف آخر — يجب استرجاعه أولاً.',
      });
    }

    const user = await User.findOne({
      where: { id: userId, companyId: req.user.companyId },
      transaction: t,
    });
    if (!user) {
      await t.rollback();
      return res.status(404).json({ message: 'الموظف غير موجود.' });
    }

    await AssetAssignment.create({
      assetId: asset.id,
      userId,
      assignedBy: req.user.id,
      conditionOnAssignment: conditionOnAssignment || asset.condition || 'GOOD',
      notes: notes || null,
      signature: signature || null,
    }, { transaction: t });

    asset.currentUserId = userId;
    asset.status = 'ASSIGNED';
    await asset.save({ transaction: t });
    await t.commit();

    recordActivity(req, 'asset.assign', {
      targetId: asset.id,
      targetName: `العهدة ${asset.assetTag}`,
      details: `سُلِّمت للموظف ${user.name}`,
    });

    return res.json({ message: 'تم التسليم.', asset });
  } catch (err) {
    await t.rollback();
    console.error('[assignAsset]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const returnAsset = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Authorization handled by route middleware (requirePermission ASSET_ASSIGN).

    const asset = await Asset.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
      transaction: t,
    });
    if (!asset) {
      await t.rollback();
      return res.status(404).json({ message: 'الأصل غير موجود.' });
    }
    if (!asset.currentUserId) {
      await t.rollback();
      return res.status(400).json({ message: 'هذا الأصل غير مخصّص لأحد.' });
    }

    const openAssignment = await AssetAssignment.findOne({
      where: { assetId: asset.id, userId: asset.currentUserId, returnedAt: null },
      order: [['assignedAt', 'DESC']],
      transaction: t,
    });
    if (openAssignment) {
      openAssignment.returnedAt = new Date();
      openAssignment.conditionOnReturn = req.body.conditionOnReturn || null;
      if (req.body.notes) openAssignment.notes = req.body.notes;
      await openAssignment.save({ transaction: t });
    }

    asset.currentUserId = null;
    asset.status = 'AVAILABLE';
    if (req.body.conditionOnReturn) asset.condition = req.body.conditionOnReturn;
    await asset.save({ transaction: t });
    await t.commit();

    recordActivity(req, 'asset.return', {
      targetId: asset.id,
      targetName: `العهدة ${asset.assetTag}`,
    });

    return res.json({ message: 'تم الاسترجاع.', asset });
  } catch (err) {
    await t.rollback();
    console.error('[returnAsset]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// MAINTENANCE LOGS
// ─────────────────────────────────────────────────────────────────
export const addMaintenance = async (req, res) => {
  try {
    // Authorization handled by route middleware.
    const asset = await Asset.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!asset) return res.status(404).json({ message: 'الأصل غير موجود.' });

    const { issue, resolution, cost, partsReplaced, ticketId } = req.body;
    if (!issue) return res.status(400).json({ message: 'الوصف مطلوب.' });

    const log = await MaintenanceLog.create({
      assetId: asset.id,
      ticketId: ticketId || null,
      performedBy: req.user.id,
      issue,
      resolution: resolution || null,
      cost: cost || 0,
      partsReplaced: partsReplaced || null,
    });

    return res.status(201).json(log);
  } catch (err) {
    console.error('[addMaintenance]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// REPORTS — manager-only
// ─────────────────────────────────────────────────────────────────
export const getAssetStats = async (req, res) => {
  try {
    // Authorization handled by route middleware (canReadAssets).
    const companyId = req.user.companyId;

    const [total, byStatus, byCategory, expiringSoon, totalValue] = await Promise.all([
      Asset.count({ where: { companyId } }),
      Asset.findAll({
        where: { companyId },
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      Asset.findAll({
        where: { companyId },
        attributes: ['categoryId', [sequelize.fn('COUNT', sequelize.col('Asset.id')), 'count']],
        include: [{ model: AssetCategory, as: 'Category', attributes: ['name', 'nameAr'] }],
        group: ['categoryId', 'Category.id'],
        raw: false,
      }),
      Asset.count({
        where: {
          companyId,
          warrantyExpiry: {
            [Op.between]: [
              new Date(),
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            ],
          },
        },
      }),
      Asset.sum('purchasePrice', { where: { companyId } }),
    ]);

    return res.json({
      total,
      byStatus,
      byCategory,
      expiringSoon,
      totalValue: totalValue || 0,
    });
  } catch (err) {
    console.error('[getAssetStats]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};
