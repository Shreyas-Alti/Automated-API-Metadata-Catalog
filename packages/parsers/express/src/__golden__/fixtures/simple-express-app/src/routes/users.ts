import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.json([]));
router.get('/:id', (req, res) => res.json({ id: req.params['id'] }));
router.post('/', (_req, res) => res.status(201).json({}));
router.put('/:id', (req, res) => res.json({ id: req.params['id'] }));
router.delete('/:id', (_req, res) => res.status(204).send());

export default router;
