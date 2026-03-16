import axios from 'axios';
import type { CollectedIdea, CollectorResult } from './types';

/**
 * Product Hunt collector
 *
 * Product Hunt requires OAuth 2.0 authentication.
 *
 * Setup instructions:
 * 1. Go to https://www.producthunt.com/v2/oauth/applications
 * 2. Create a new application
 * 3. Get your Client ID and Client Secret
 * 4. Generate an access token or implement OAuth flow
 * 5. Set PRODUCTHUNT_TOKEN environment variable
 *
 * GraphQL API: https://api.producthunt.com/v2/api/graphql
 */

const PH_API_URL = 'https://api.producthunt.com/v2/api/graphql';

const POSTS_QUERY = `
  query GetTopPosts($after: String) {
    posts(first: 20, after: $after, order: VOTES) {
      edges {
        node {
          id
          name
          tagline
          description
          votesCount
          commentsCount
          createdAt
          url
          website
          topics {
            edges {
              node {
                name
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface ProductHuntPost {
  id: string;
  name: string;
  tagline: string;
  description: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  url: string;
  website?: string;
  topics: {
    edges: Array<{
      node: { name: string };
    }>;
  };
}

function convertToIdea(post: ProductHuntPost): CollectedIdea {
  const description = post.description || post.tagline;
  const topics = post.topics.edges.map((e) => e.node.name).join(', ');

  return {
    title: post.name,
    description,
    url: post.url,
    source: 'producthunt',
    sourceId: post.id,
    sourceScore: post.votesCount,
    sourceComments: post.commentsCount,
    discoveredAt: post.createdAt,
    metadata: {
      tagline: post.tagline,
      website: post.website,
      topics,
    },
  };
}

export async function collectProductHunt(): Promise<CollectorResult> {
  const startTime = Date.now();
  const items: CollectedIdea[] = [];
  const errors: string[] = [];

  const apiToken = process.env.PRODUCTHUNT_TOKEN;

  if (!apiToken) {
    return {
      source: 'producthunt',
      items: [],
      errors: [
        'Product Hunt API token not configured. Set PRODUCTHUNT_TOKEN environment variable.',
      ],
      duration: Date.now() - startTime,
    };
  }

  try {
    const response = await axios.post(
      PH_API_URL,
      {
        query: POSTS_QUERY,
        variables: {},
      },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    if (response.data.errors) {
      errors.push(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
    }

    const posts = response.data.data?.posts?.edges || [];

    for (const edge of posts) {
      try {
        items.push(convertToIdea(edge.node));
      } catch (error) {
        errors.push(`Failed to convert post ${edge.node.id}: ${error}`);
      }
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error || error.message;
      errors.push(`Product Hunt API error: ${message}`);
    } else {
      errors.push(`Product Hunt error: ${error}`);
    }
  }

  const duration = Date.now() - startTime;

  return {
    source: 'producthunt',
    items,
    errors,
    duration,
  };
}
