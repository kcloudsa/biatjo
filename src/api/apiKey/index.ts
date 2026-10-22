import express from 'express';
import apiKeyModel from '../../models/apiKeyModel';

const router = express.Router();

// Create new key
router.post('/create', async (req, res) => {
  try {
    const { label, userID } = req.body;
    if (!label || !userID) {
      res.status(400).json({ message: 'label or userID are required' });
      return;
    }

    const key = require('crypto').randomBytes(32).toString('hex');

    const newKey = await apiKeyModel.create({
      key,
      label,
      userID,
      active: true,
    });
    res.status(201).json({ key: newKey.key, label: newKey.label });
    return;
  } catch (err) {
    console.log('error', err);
    return;
  }
});

// List keys
router.get('/', async (req, res) => {
  const keys = await apiKeyModel.find(
    {},
    '-_id userID key label active createdAt',
  );
  res.json(keys);
  return;
});

// Deactivate key
router.patch('/deactivate/:key', async (req, res) => {
  const { key } = req.params;
  if (!key) {
    res.status(400).json({ message: 'label is required' });
    return;
  }
  await apiKeyModel.updateOne({ key }, { active: false });
  res.json({
    message: `Key deactivated`,
    active: false,
    key: `${key} `,
  });
  return;
});

// Activate key
router.patch('/activate/:key', async (req, res) => {
  const { key } = req.params;
  if (!key) {
    res.status(400).json({ message: 'label is required' });
    return;
  }
  await apiKeyModel.updateOne({ key }, { active: true });
  res.json({
    message: `Key activated`,
    active: true,
    key: `${key} `,
  });
  return;
});

export default router;
