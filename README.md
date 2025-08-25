# Recipe Chatbot v1 🍳

An intelligent recipe chatbot that helps users find recipes based on available ingredients, dietary constraints, and preferences. Built with a using LangGraph and Neo4j GraphRAG.

## 🏗️ Technology Stack

### AI & Orchestration
- **LangGraph** - Multi-agent workflow orchestration and state management
- **LangChain** - LLM integration and prompt management
- **OpenAI GPT-4o-mini** - Natural language understanding and generation
- **OpenAI Embeddings** - Vector representations for semantic search

### Database & Storage
- **Neo4j** - Graph database for GraphRAG (Graph Retrieval-Augmented Generation)
  - Stores recipes, ingredients, and substitution relationships
  - Enables complex graph traversals for ingredient matching including possible substitutions
  - Vector search with embeddings for semantic recipe discovery
- **PostgreSQL** - Persistent state storage for conversation history
  - LangGraph checkpoint persistence

## 🎭 Architecture Overview

### LangGraph Agent Workflow
The core intelligence is built using a state machine with the following nodes:

1. **Parser** - Extracts user intent and filters from conversation
2. **Router** - Determines the appropriate search strategy
3. **Graph Search** - Ingredient-based recipe matching using Neo4j graph traversals
4. **Semantic Search** - Vector similarity search using embeddings
5. **Substitute Search** - Finds ingredient alternatives for missing items
6. **Conversation Handlers** - Manages dialogue flow and user interaction

### State Management
- **Facts Object** - Maintains user preferences, search results, and flags
- **Message History** - Preserves conversation context
- **PostgreSQL Checkpointer** - Enables conversation persistence across sessions

### Data Architecture

#### Neo4j Graph Structure
```
Recipe ──REQUIRES──> Ingredient <──SUBS── Ingredient
   │                     │
   └─HAS_DIET──> Diet    └─[fuzzy search index]
   │
   └─[vector embeddings]
```

#### Key Relationships
- **Recipe-Ingredient**: `REQUIRES` relationship with optional amounts
- **Ingredient-Ingredient**: `SUBS` relationship with quality scores and ratios
- **Recipe-Diet**: `HAS_DIET` for dietary constraint filtering

All used graph queries can be found at [RecipeQueries.ts](data/RecipeQueries.ts)

## 🔄 Conversation Flow

The chatbot operates through intelligent dialogue management:

### Intent Detection
- **search_recipes** - Finding new recipes based on criteria
- **pick_candidate** - Selecting from presented recipe options  
- **search_substitutes** - Finding alternatives for missing ingredients
- **other** - General conversation and questions

### Search Strategies
1. **Graph-based Search** - Traverses ingredient relationships for direct and substitute matches
2. **Semantic Search** - Uses vector embeddings to find conceptually similar recipes

### Adaptive Responses
- **No Results** - Suggests filter refinement
- **Too Many Results** - Requests additional criteria or presents top options
- **Perfect Match** - Provides detailed recipe information
- **Missing Ingredients** - Offers substitute suggestions


### Database Setup
The seeding process creates:
- Recipe nodes with embeddings for semantic search
- Ingredient nodes with fuzzy search capabilities
- Substitution relationships with quality scores
- Dietary constraint classifications
- Vector and fulltext search indexes

Fixtures used for seeding are [DefaultRecipies.ts](data/DefaultRecipies.ts) and [Substitutions.ts](data/Substitutions.ts)

To seed use `yarn seed`