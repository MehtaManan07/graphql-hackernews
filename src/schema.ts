import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLContext } from "./context";
import type { Link } from "@prisma/client";
import { GraphQLError } from "graphql";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";

const parseIntSafe = (value: string): number | null => {
  if (/^(\d+)$/.test(value)) {
    return parseInt(value, 10);
  }
  return null;
};
const typeDefinitions = /* GraphQL */ `
  type Query {
    info: String!
    feed(filterNeedle: String): [Link!]!
    comment(id: ID!): Comment
    allComments: [Comment!]!
  }

  type Comment {
    id: ID!
    body: String!
  }

  type Mutation {
    postLink(url: String!, description: String!): Link!
    postCommentOnLink(linkId: ID!, body: String!): Comment!
  }

  type Link {
    id: ID!
    description: String!
    url: String!
    comments: [Comment!]!
  }
`;

const resolvers = {
  Query: {
    info: () => `This is the API of a Hackernews Clone`,
    // 3
    feed(
      parent: unknown,
      args: { filterNeedle?: string },
      context: GraphQLContext
    ) {
      const where = args.filterNeedle
        ? {
            OR: [
              { description: { contains: args.filterNeedle } },
              { url: { contains: args.filterNeedle } },
            ],
          }
        : {};
      return context.prisma.link.findMany({ where });
    },
    async comment(
      parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) {
      return context.prisma.comment.findUnique({
        where: { id: parseInt(args.id) },
      });
    },
    async allComments(parent: unknown, args: {}, context: GraphQLContext) {
      return context.prisma.comment.findMany();
    },
  },
  Mutation: {
    async postLink(
      parent: unknown,
      args: { description: string; url: string },
      context: GraphQLContext
    ) {
      const { prisma } = context;

      const newLink = await prisma.link.create({
        data: { description: args.description, url: args.url },
      });
      return newLink;
    },
    async postCommentOnLink(
      parent: unknown,
      args: { linkId: string; body: string },
      context: GraphQLContext
    ) {
      const linkId = parseIntSafe(args.linkId);
      if (linkId === null) {
        return Promise.reject(
          new GraphQLError(
            `Cannot post comment on non-existing link with id '${args.linkId}'.`
          )
        );
      }
      const newComment = await context.prisma.comment
        .create({
          data: {
            linkId: parseInt(args.linkId),
            body: args.body,
          },
        })
        .catch((err: unknown) => {
          if (
            err instanceof PrismaClientKnownRequestError &&
            err.code === "P2003"
          ) {
            console.log({ err });
            return Promise.reject(
              new GraphQLError(
                `Cannot post comment on non-existing link with id '${args.linkId}'.`
              )
            );
          }
          return Promise.reject(err);
        });
      return newComment;
    },
  },
  // 4
  Link: {
    id: (parent: Link) => parent.id,
    description: (parent: Link) => parent.description,
    url: (parent: Link) => parent.url,
    comments: (parent: Link, args: {}, context: GraphQLContext) => {
      return context.prisma.comment.findMany({
        where: {
          linkId: parent.id,
        },
      });
    },
  },
};

export const schema = makeExecutableSchema({
  resolvers: [resolvers],
  typeDefs: [typeDefinitions],
});
