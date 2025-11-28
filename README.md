# HIBP Checker

A TypeScript tool to check email addresses against the [Have I Been Pwned](https://haveibeenpwned.com/) API to identify data breaches. Results are stored in MongoDB for easy access and analysis.

## Features

- Batch check multiple email addresses from a text file
- Automatic rate limiting handling
- Duplicate prevention with MongoDB unique indexes
- TypeScript for type safety
- Stores breach data in MongoDB for analysis

## Prerequisites

- Node.js
- MongoDB
- [Have I Been Pwned API key](https://haveibeenpwned.com/API/Key)

## Installation

1. Clone or download this repository

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `config.json` file in the root directory:
   ```json
   {
     "key": "your-hibp-api-key-here",
     "delay": 1500,
     "mongoUri": "mongodb://your-ip:your-port",
     "database": "your-db",
     "collection": "your-collection"
   }
   ```
   - `key`: Your HIBP API key
   - `delay`: Delay between requests in milliseconds (minimum 1500ms recommended)
   - `mongoUri`: MongoDB connection string (e.g., "mongodb://127.0.0.1:27017")
   - `database`: Name of the MongoDB database to use
   - `collection`: Name of the collection where breach data will be stored 

4. Create a `data.txt` file with one email address per line:
   ```
   john.d@group.org
   bob@school.edu
   alice_97@example.com
   djane@mail.com
   ```

## Usage

### Build the TypeScript code:
```bash
npm run build
```

### Run the checker:
```bash
npm start
```

### Or build and run in one command:
```bash
npm run dev
```

## How It Works

1. Reads email addresses from `data.txt`
2. Queries the HIBP API for each email
3. Stores results in MongoDB
4. Automatically handles rate limiting (429 responses)
5. Prevents duplicate entries with unique email index

## MongoDB Structure

**Database**: `HIBP`
**Collection**: `Breaches`

Each document contains:
```javascript
{
  email: "user@example.com",
  breaches: [
    {
      Name: "Adobe",
      Title: "Adobe",
      Domain: "adobe.com",
      BreachDate: "2013-10-04",
      PwnCount: 152445165,
      // ... other breach details
    }
  ]
}
```

## Output

The script logs:
- Successful breach checks with data
- Duplicate email attempts
- Rate limiting messages
- HTTP errors

Example:
```
Unique index on email field ensured
user@example.com [ { Name: 'Adobe', ... } ]
duplicate@example.com duplicate
Done
```

## Use Cases

- Security audits for employee email accounts
- Personal breach monitoring
- Compliance reporting
- Security awareness training data

## Notes

- The HIBP API requires a minimum delay of 1500ms between requests
- Sensitive breaches may not be returned in API responses
- The script automatically creates a unique index on the email field to prevent duplicates
