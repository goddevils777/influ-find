import { Router } from 'express';
import { searchByCity, getParserStatus, forceParseCity } from '../controllers/searchController';

const router = Router();

router.post('/city', searchByCity);
router.get('/status', getParserStatus);
router.post('/parse', forceParseCity);

export default router;