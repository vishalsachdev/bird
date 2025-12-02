#!/usr/bin/env node
/**
 * bird - CLI tool for posting tweets and replies
 *
 * Usage:
 *   bird tweet "Hello world!"
 *   bird reply <tweet-id> "This is a reply"
 *   bird reply <tweet-url> "This is a reply"
 *   bird read <tweet-id-or-url>
 */

import { Command } from 'commander';
import { resolveCredentials } from './lib/cookies.js';
import { extractTweetId } from './lib/extract-tweet-id.js';
import { TwitterClient } from './lib/twitter-client.js';
import { SweetisticsClient } from './lib/sweetistics-client.js';

const program = new Command();

program.name('bird').description('Post tweets and replies via Twitter/X GraphQL API').version('0.1.0');

// Global options for authentication
program
  .option('--auth-token <token>', 'Twitter auth_token cookie')
  .option('--ct0 <token>', 'Twitter ct0 cookie')
  .option('--chrome-profile <name>', 'Chrome profile name for cookie extraction')
  .option('--sweetistics-api-key <key>', 'Sweetistics API key (or set SWEETISTICS_API_KEY)')
  .option('--sweetistics-base-url <url>', 'Sweetistics base URL', process.env.SWEETISTICS_BASE_URL || 'https://sweetistics.com');

function resolveSweetisticsConfig(options: { sweetisticsApiKey?: string; sweetisticsBaseUrl?: string }) {
  const apiKey =
    options.sweetisticsApiKey ||
    process.env.SWEETISTICS_API_KEY ||
    process.env.SWEETISTICS_LOCALHOST_API_KEY ||
    null;

  const baseUrl = options.sweetisticsBaseUrl || process.env.SWEETISTICS_BASE_URL || 'https://sweetistics.com';

  return { apiKey, baseUrl };
}

// Tweet command
program
  .command('tweet')
  .description('Post a new tweet')
  .argument('<text>', 'Tweet text')
  .action(async (text: string) => {
    const opts = program.opts();
    const sweetistics = resolveSweetisticsConfig(opts);

    if (sweetistics.apiKey) {
      try {
        const client = new SweetisticsClient({
          baseUrl: sweetistics.baseUrl,
          apiKey: sweetistics.apiKey,
        });
        const result = await client.tweet(text);
        if (result.success) {
          console.log('✅ Tweet posted via Sweetistics!');
          if (result.tweetId) {
            console.log(`🔗 https://x.com/i/status/${result.tweetId}`);
          }
          return;
        }
        console.error(`❌ Sweetistics post failed: ${result.error ?? 'Unknown error'}`);
        process.exit(1);
      } catch (error) {
        console.error(`❌ Sweetistics error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }

    const { cookies, warnings } = await resolveCredentials({
      authToken: opts.authToken,
      ct0: opts.ct0,
      chromeProfile: opts.chromeProfile,
    });

    for (const warning of warnings) {
      console.error(`⚠️  ${warning}`);
    }

    if (!cookies.authToken || !cookies.ct0) {
      console.error('❌ Missing required credentials');
      process.exit(1);
    }

    if (cookies.source) {
      console.error(`📍 Using credentials from: ${cookies.source}`);
    }

    const client = new TwitterClient({ cookies });
    const result = await client.tweet(text);

    if (result.success) {
      console.log('✅ Tweet posted successfully!');
      console.log(`🔗 https://x.com/i/status/${result.tweetId}`);
    } else {
      console.error(`❌ Failed to post tweet: ${result.error}`);
      process.exit(1);
    }
  });

// Reply command
program
  .command('reply')
  .description('Reply to an existing tweet')
  .argument('<tweet-id-or-url>', 'Tweet ID or URL to reply to')
  .argument('<text>', 'Reply text')
  .action(async (tweetIdOrUrl: string, text: string) => {
    const opts = program.opts();
    const sweetistics = resolveSweetisticsConfig(opts);
    const tweetId = extractTweetId(tweetIdOrUrl);

    if (sweetistics.apiKey) {
      try {
        const client = new SweetisticsClient({
          baseUrl: sweetistics.baseUrl,
          apiKey: sweetistics.apiKey,
        });
        const result = await client.tweet(text, tweetId);
        if (result.success) {
          console.log('✅ Reply posted via Sweetistics!');
          if (result.tweetId) {
            console.log(`🔗 https://x.com/i/status/${result.tweetId}`);
          }
          return;
        }
        console.error(`❌ Sweetistics reply failed: ${result.error ?? 'Unknown error'}`);
        process.exit(1);
      } catch (error) {
        console.error(`❌ Sweetistics error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }

    const { cookies, warnings } = await resolveCredentials({
      authToken: opts.authToken,
      ct0: opts.ct0,
      chromeProfile: opts.chromeProfile,
    });

    for (const warning of warnings) {
      console.error(`⚠️  ${warning}`);
    }

    if (!cookies.authToken || !cookies.ct0) {
      console.error('❌ Missing required credentials');
      process.exit(1);
    }

    if (cookies.source) {
      console.error(`📍 Using credentials from: ${cookies.source}`);
    }

    console.error(`📝 Replying to tweet: ${tweetId}`);

    const client = new TwitterClient({ cookies });
    const result = await client.reply(text, tweetId);

    if (result.success) {
      console.log('✅ Reply posted successfully!');
      console.log(`🔗 https://x.com/i/status/${result.tweetId}`);
    } else {
      console.error(`❌ Failed to post reply: ${result.error}`);
      process.exit(1);
    }
  });

// Read command - fetch tweet content
program
  .command('read')
  .description('Read/fetch a tweet by ID or URL')
  .argument('<tweet-id-or-url>', 'Tweet ID or URL to read')
  .option('--json', 'Output as JSON')
  .action(async (tweetIdOrUrl: string, cmdOpts: { json?: boolean }) => {
    const opts = program.opts();
    const { cookies, warnings } = await resolveCredentials({
      authToken: opts.authToken,
      ct0: opts.ct0,
      chromeProfile: opts.chromeProfile,
    });

    for (const warning of warnings) {
      console.error(`⚠️  ${warning}`);
    }

    if (!cookies.authToken || !cookies.ct0) {
      console.error('❌ Missing required credentials');
      process.exit(1);
    }

    const tweetId = extractTweetId(tweetIdOrUrl);
    const client = new TwitterClient({ cookies });
    const result = await client.getTweet(tweetId);

    if (result.success && result.tweet) {
      if (cmdOpts.json) {
        console.log(JSON.stringify(result.tweet, null, 2));
      } else {
        console.log(`@${result.tweet.author.username} (${result.tweet.author.name}):`);
        console.log(result.tweet.text);
        if (result.tweet.createdAt) {
          console.log(`\n📅 ${result.tweet.createdAt}`);
        }
        console.log(
          `❤️ ${result.tweet.likeCount ?? 0}  🔁 ${result.tweet.retweetCount ?? 0}  💬 ${result.tweet.replyCount ?? 0}`,
        );
      }
    } else {
      console.error(`❌ Failed to read tweet: ${result.error}`);
      process.exit(1);
    }
  });

// Search command - find tweets
program
  .command('search')
  .description('Search for tweets')
  .argument('<query>', 'Search query (e.g., "@clawdbot" or "from:clawdbot")')
  .option('-n, --count <number>', 'Number of tweets to fetch', '10')
  .option('--json', 'Output as JSON')
  .action(async (query: string, cmdOpts: { count?: string; json?: boolean }) => {
    const opts = program.opts();
    const { cookies, warnings } = await resolveCredentials({
      authToken: opts.authToken,
      ct0: opts.ct0,
      chromeProfile: opts.chromeProfile,
    });

    for (const warning of warnings) {
      console.error(`⚠️  ${warning}`);
    }

    if (!cookies.authToken || !cookies.ct0) {
      console.error('❌ Missing required credentials');
      process.exit(1);
    }

    const client = new TwitterClient({ cookies });
    const count = parseInt(cmdOpts.count || '10', 10);
    const result = await client.search(query, count);

    if (result.success && result.tweets) {
      if (cmdOpts.json) {
        console.log(JSON.stringify(result.tweets, null, 2));
      } else {
        if (result.tweets.length === 0) {
          console.log('No tweets found.');
        } else {
          for (const tweet of result.tweets) {
            console.log(`\n@${tweet.author.username} (${tweet.author.name}):`);
            console.log(tweet.text);
            if (tweet.createdAt) {
              console.log(`📅 ${tweet.createdAt}`);
            }
            console.log(`🔗 https://x.com/${tweet.author.username}/status/${tweet.id}`);
            console.log('─'.repeat(50));
          }
        }
      }
    } else {
      console.error(`❌ Search failed: ${result.error}`);
      process.exit(1);
    }
  });

// Mentions command - shortcut to search for @username mentions
program
  .command('mentions')
  .description('Find tweets mentioning @clawdbot')
  .option('-n, --count <number>', 'Number of tweets to fetch', '10')
  .option('--json', 'Output as JSON')
  .action(async (cmdOpts: { count?: string; json?: boolean }) => {
    const opts = program.opts();
    const { cookies, warnings } = await resolveCredentials({
      authToken: opts.authToken,
      ct0: opts.ct0,
      chromeProfile: opts.chromeProfile,
    });

    for (const warning of warnings) {
      console.error(`⚠️  ${warning}`);
    }

    if (!cookies.authToken || !cookies.ct0) {
      console.error('❌ Missing required credentials');
      process.exit(1);
    }

    const client = new TwitterClient({ cookies });
    const count = parseInt(cmdOpts.count || '10', 10);
    const result = await client.search('@clawdbot', count);

    if (result.success && result.tweets) {
      if (cmdOpts.json) {
        console.log(JSON.stringify(result.tweets, null, 2));
      } else {
        if (result.tweets.length === 0) {
          console.log('No mentions found.');
        } else {
          console.log(`Found ${result.tweets.length} mentions:\n`);
          for (const tweet of result.tweets) {
            console.log(`@${tweet.author.username} (${tweet.author.name}):`);
            console.log(tweet.text);
            if (tweet.createdAt) {
              console.log(`📅 ${tweet.createdAt}`);
            }
            console.log(`🔗 https://x.com/${tweet.author.username}/status/${tweet.id}`);
            console.log('─'.repeat(50));
          }
        }
      }
    } else {
      console.error(`❌ Failed to fetch mentions: ${result.error}`);
      process.exit(1);
    }
  });

// Check command - verify credentials
program
  .command('check')
  .description('Check credential availability')
  .action(async () => {
    const opts = program.opts();
    const { cookies, warnings } = await resolveCredentials({
      authToken: opts.authToken,
      ct0: opts.ct0,
      chromeProfile: opts.chromeProfile,
    });

    console.log('🔍 Credential Check');
    console.log('─'.repeat(40));

    if (cookies.authToken) {
      console.log(`✅ auth_token: ${cookies.authToken.slice(0, 10)}...`);
    } else {
      console.log('❌ auth_token: not found');
    }

    if (cookies.ct0) {
      console.log(`✅ ct0: ${cookies.ct0.slice(0, 10)}...`);
    } else {
      console.log('❌ ct0: not found');
    }

    if (cookies.source) {
      console.log(`📍 Source: ${cookies.source}`);
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      for (const warning of warnings) {
        console.log(`   - ${warning}`);
      }
    }

    if (cookies.authToken && cookies.ct0) {
      console.log('\n✅ Ready to tweet!');
    } else {
      console.log('\n❌ Missing credentials. Options:');
      console.log('   1. Login to x.com in Chrome');
      console.log('   2. Set AUTH_TOKEN and CT0 environment variables');
      console.log('   3. Use --auth-token and --ct0 flags');
      process.exit(1);
    }
  });

program.parse();
