import type { Article, SystemDesign } from '@sda/shared';
import { capTheorem, circuitBreakers, messageQueues, scaling } from './articles/part2';
import { databaseIndexing, eventLoop, rateLimiting, redisCaching } from './articles/part1';
import { ecommerceOrders } from './designs/ecommerce-orders';
import { messagingSystem } from './designs/messaging-system';
import { plannedDesigns } from './designs/planned';
import { urlShortener } from './designs/url-shortener';

export const systemDesigns: SystemDesign[] = [urlShortener, messagingSystem, ecommerceOrders, ...plannedDesigns];

export const articles: Article[] = [eventLoop, redisCaching, rateLimiting, databaseIndexing, capTheorem, scaling, messageQueues, circuitBreakers];

export { categories, tags } from './taxonomy';
export { glossary } from './glossary';
export { learningPaths } from './learning-paths';
export { architecturePatterns, type ArchitecturePattern } from './patterns';
export { playgroundConfigs, simulatorDiagram, type PlaygroundConfig } from './playground';
export { plannedArticleTopics } from './designs/planned';
