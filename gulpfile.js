const {series, task} = require('gulp');
const {src, dest} = require('gulp');
var through = require('through2');
var parser = require('gulp-file-parser');

var rename = require('gulp-rename');

var path = require('path');

var File = require('vinyl');

var appModule = [];

function generateDtoAndSchemaFromjson(collectionName, attributes) {
  'use strict';
  return through.obj(function (file, enc, next) {
    var mydata = JSON.parse(file.contents.toString('utf8'));
    var base = path.join(file.path, '..');
    var filename = path.basename(file.path, '.json').replace(/-/g, '_');
    const collectionaAttributes = Object.entries(mydata.properties).map((attribute) => {
      return {
        key: attribute[0],
        type: attribute[1].type.toString().replace(/date/g, 'Date')
      };
    });
    if (collectionaAttributes.length > 0) {
      var dtoFile = new File({
        base: base,
        path: path.join(base, filename + '.dto.ts'),
        contents: new Buffer(getDTO(mydata.name, collectionaAttributes))
      });
      this.push(dtoFile);

      var schemaFile = new File({
        base: base,
        path: path.join(base, filename + '.schema.ts'),
        contents: new Buffer(getSchema(mydata.name, collectionaAttributes))
      });
      this.push(schemaFile);

      var serviceFile = new File({
        base: base,
        path: path.join(base, filename + '.service.ts'),
        contents: new Buffer(getService(mydata.name, filename))
      });
      this.push(serviceFile);

      var moduleFile = new File({
        base: base,
        path: path.join(base, filename + '.module.ts'),
        contents: new Buffer(getModule(mydata.name, filename))
      });
      this.push(moduleFile);

      var graphqlFile = new File({
        base: base,
        path: path.join(base, filename + '.graphql'),
        contents: new Buffer(getGraphQL(mydata.name, filename, collectionaAttributes))
      });
      this.push(graphqlFile);
      var resolverFile = new File({
        base: base,
        path: path.join(base, filename + '.resolver.ts'),
        contents: new Buffer(getResolver(mydata.name, filename))
      });
      this.push(resolverFile);
      appModule.push(`${mydata.name}Module`);
    }

    next();
  });
}

function generateAngularApolloFromjson(collectionName, attributes) {
  'use strict';
  return through.obj(function (file, enc, next) {
    var mydata = JSON.parse(file.contents.toString('utf8'));
    var base = path.join(file.path, '..');
    var filename = path.basename(file.path, '.json').replace(/-/g, '_');
    const collectionaAttributes = Object.entries(mydata.properties).map((attribute) => {
      return {
        key: attribute[0],
        type: attribute[1].type.toString().replace(/date/g, 'Date')
      };
    });
    if (collectionaAttributes.length > 0) {
      var interfaceFile = new File({
        base: base,
        path: path.join(base, filename + '.interface.ts'),
        contents: new Buffer(getInterface(mydata.name, collectionaAttributes))
      });
      this.push(interfaceFile);

      var gqlApolloFile = new File({
        base: base,
        path: path.join(base, filename + '.graphql.ts'),
        contents: new Buffer(getApolloGQL(filename, mydata.name, collectionaAttributes))
      });
      this.push(gqlApolloFile);

      var serviceApolloFile = new File({
        base: base,
        path: path.join(base, filename + '.service.ts'),
        contents: new Buffer(getApolloService(mydata.name, filename))
      });
      this.push(serviceApolloFile);

      appModule.push(`${mydata.name}Module`);
    }

    next();
  });
}

function generateAppModule() {
  'use strict';
  return through.obj(function (file, enc, next) {
    var appModuleFile = new File({
      base: './',
      path: path.join('./', 'app.module.ts'),
      contents: new Buffer(`//${appModule.join(',')}`)
    });
    this.push(appModuleFile);

    next();
  });
}
function generateGQLModule() {
  'use strict';
  return through.obj(function (file, enc, next) {
    var appModuleFile = new File({
      base: './',
      path: path.join('./', 'app.graphql.ts'),
      contents: new Buffer(`
      import { NgModule } from '@angular/core';
import { HttpClientModule, HttpHeaders } from '@angular/common/http';
import { APOLLO_OPTIONS } from 'apollo-angular';
import { HttpLinkModule, HttpLink } from 'apollo-angular-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloLink, split, from } from 'apollo-link';
import { WebSocketLink } from 'apollo-link-ws';
import { getMainDefinition } from 'apollo-utilities';


const subscriptionLink = new WebSocketLink({
  uri: 'ws://localhost:3000/graphql',
  options: {
    reconnect: true,
    connectionParams: {
      authToken: localStorage.getItem('token') || null,
    },
  },
});

const authMiddleware = new ApolloLink((operation: any, forward: any) => {
  operation.setContext({
    headers: new HttpHeaders().set(
      'Authorization',
      'Bearer '+localStorage.getItem("token") + '}' || null,
    ),
  });

  return forward(operation);
});

export function createApollo(httpLink: HttpLink) {
  return {
    link: from([
      authMiddleware,
      split(
        ({ query }) => {
          interface Definintion {
            kind: string;
            operation?: string;
          }

          const { kind, operation }: Definintion = getMainDefinition(query);
          return kind === 'OperationDefinition' && operation === 'subscription';
        },
        subscriptionLink,
        httpLink.create({
          uri: 'http://localhost:3000/graphql',
        }),
      ),
    ]),
    cache: new InMemoryCache(),
  };
}

@NgModule({
  exports: [HttpClientModule, HttpLinkModule],
  providers: [
    {
      provide: APOLLO_OPTIONS,
      useFactory: createApollo,
      deps: [HttpLink],
    },
  ],
})
export class GraphQLModule { }
      `)
    });
    this.push(appModuleFile);

    next();
  });
}

function getDTO(collectionName, attributes) {
  const generatedAttributes = attributes
    .map((attribute) => {
      const type = attribute.type === 'array' ? 'object[]' : attribute.type;
      return `readonly ${attribute.key}: ${type};`;
    })
    .join('\n');
  return `import * as mongoose from 'mongoose';
export class Create${collectionName}Dto {
     readonly _id: mongoose.Types.ObjectId;\n
    ${generatedAttributes}
}`;
}

function getInterface(collectionName, attributes) {
  const generatedAttributes = attributes
    .map((attribute) => {
      const type = attribute.type === 'array' ? 'object[]' : attribute.type;
      return `${attribute.key}: ${type};`;
    })
    .join('\n');
  return `
export Interface ${collectionName} {
    ${generatedAttributes}
}

`;
}

function getApolloGQL(filename, collectionName, attributes) {
  const generatedAttributes = attributes
    .map((attribute) => {
      const type = attribute.type === 'array' ? 'object[]' : attribute.type;
      return `${attribute.key}: ${type};`;
    })
    .join('\n');
  return `import { Injectable } from '@angular/core';
import { Mutation, Query, Subscription } from 'apollo-angular';
import gql from 'graphql-tag';

export Interface ${collectionName} {
    ${generatedAttributes}
}

export interface ${collectionName}Response {
  ${filename}: ${collectionName}[];
}

@Injectable({
  providedIn: 'root',
})
export class ${collectionName}UpdatedGQL extends Subscription {
  document = gql\`
  subscription {
  ${filename}Updated {
    _id
  }
}
  \`;
}

export class ${collectionName}AddedGQL extends Subscription {
  document = gql\`
  subscription {
  ${filename}Added {
    _id
  }
}
  \`;
}
export class ${collectionName}DeletedGQL extends Subscription {
  document = gql\`
  subscription {
  ${filename}Deleted {
    _id
  }
}
  \`;
}

export class UpdateOne${collectionName}GQL extends Mutation {
  document = gql\`
    mutation($id:String!, $dat:JSON!) {
  ${filename}_updateOne( where:{_id:$id},data:$dat){
  _id
}}
  \`;
}

export class UpdateMany${collectionName}GQL extends Mutation {
  document = gql\`
    mutation($id:String!, $dat:JSON!) {
  ${filename}_updateMany( where:{_id:$id},data:$dat){
  _id
}}
  \`;
}

export class All${collectionName}GQL extends Query<${collectionName}Response> {
  document = gql\`
    query get${collectionName}($first:Int!) {
      ${filename}(first:$first) {
        _id
        title

      }
    }
  \`;

`;
}

function getSchema(collectionName, attributes) {
  const generatedAttributes = attributes
    .map((attribute) => {
      const type = attribute.type === 'array' ? 'object[]' : attribute.type;
      return `@Prop()\n${attribute.key}: ${type};\n`;
    })
    .join('\n');
  return `import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ${collectionName} extends Document {

${generatedAttributes}
}

export const ${collectionName}Schema = SchemaFactory.createForClass(${collectionName});`;
}

function getModule(collectionName, filename) {
  return `import { Module } from '@nestjs/common';
import { ${collectionName}, ${collectionName}Schema } from './schema/${filename}.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ${collectionName}Service } from './${filename}.service';
import { ${collectionName}Resolver } from './${filename}.resolver';
import { PubSub } from 'graphql-subscriptions';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

@Module({
    imports: [MongooseModule.forFeature([{ collection: ${collectionName}.name, name: ${collectionName}.name, schema: ${collectionName}Schema }])],
 providers: [${collectionName}Resolver, ${collectionName}Service, {
    provide: 'PUB_SUB',
    useFactory: () => {


      return new RedisPubSub({
        publisher: new Redis({
          host: 'localhost',
          port: 6379
        }),
        subscriber: new Redis({
          host: 'localhost',
          port: 6379
        }),
      });
    },
  }],
  exports: [ ${collectionName}Service],
})
export class ${collectionName}Module {}`;
}

function getApolloService(collectionName, filename) {
  return `import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import gql from 'graphql-tag';
import { All${collectionName}GQL, ${collectionName}UpdatedGQL, Update${collectionName}GQL } from '../grapgql/${filename}.graphql';

const update${collectionName} = gql\`
 mutation($id:String!, $dat:JSON!) {
  ${filename}_updateOne( where:{_id:$id},data:$dat){
  _id
}}
\`;

@Injectable({
  providedIn: 'root'
})
export class AppService {

  constructor(private all${collectionName}GQL: All${collectionName}GQL, private update${collectionName}GQL: Update${collectionName}GQL, private ${filename}Updated: ${collectionName}UpdatedGQL) { }

  async ${filename}_updateOne(id: string, data: any) {
    return this.update${collectionName}GQL.mutate(
      {
        id: id,
        dat: data
      }
    );
  }

}
`;
}

function getController(collectionName, filename) {
  return `import { ${collectionName}Service } from './${filename}.service';
import { Controller, Post, Get, Body } from '@nestjs/common';
import { Create${collectionName}Dto } from './dto/${filename}.dto';
import { ${collectionName} } from './schemas/${filename}.schema';

@Controller('${filename}')
export class ${collectionName}Controller {
    constructor(private readonly ${filename}Service : ${collectionName}Service ) {
}
    @Post()
    async create(@Body() create${collectionName}Dto: Create${collectionName}Dto) {
        await this.${filename}Service.create(create${collectionName}Dto);
    }

    @Get()
    async findAll(): Promise<${collectionName}[]> {
        const res = await this.${filename}Service.findAll();

        return res;
    }
}`;
}
function getGraphQL(collectionName, filename, attributes) {
  const generatedAttributes = attributes
    .map((attribute) => {
      //
      const type = attribute.type
        .replace(/string/g, 'String')
        .replace(/number/g, 'Int')
        .replace(/date/g, 'Date')
        .replace(/Date/g, 'Date')
        .replace(/boolean/g, 'Boolean')
        .replace(/array/g, '[JSON]')
        .replace(/object/g, 'JSON');
      //
      return `${attribute.key}: ${type}`;
    })
    .join('\n');

  return `
scalar JSON
scalar Date

enum QueryOne {
  findById
  findBySID
}

enum QueryMany {
  findBySID
}

enum Aggregate {
  aggregate
}

type Mutation {
  ${filename}_create(data: JSON): ${collectionName}
  ${filename}_updateOne(where: JSON, data: JSON): ${collectionName}
  ${filename}_updateMany(where: JSON, data: JSON): ${collectionName}
  ${filename}_deleteOneById(_id:ID): ${collectionName}
  ${filename}_deleteBySID(sid:ID): [${collectionName}]
  ${filename}_deleteByQuery(where: JSON): [${collectionName}]
}

  type Query {
  ${filename}(first: Int, skip: Int, where: JSON, sort:JSON, aggregation:JSON): [${collectionName}]
  ${filename}_findById(_id:ID): ${collectionName}
  ${filename}_queryOne(query: QueryOne, data: JSON): ${collectionName}
  ${filename}_queryMany(query: QueryMany, data: JSON): [${collectionName}]
  ${filename}_aggregate(query: Aggregate, data: JSON): [${collectionName}]
}

type Subscription {
  ${filename}Added: ${collectionName}
  ${filename}Updated: ${collectionName}
  ${filename}Deleted: ${collectionName}
}


type ${collectionName} {
    _id:ID
${generatedAttributes}
}`;
}

function getResolver(collectionName, filename) {
  return `import { ${collectionName}Service } from './${filename}.service';
import { Args, Int, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { PubSubEngine } from 'graphql-subscriptions';
import { GqlAuthGuard } from 'src/GqlAuth/auth.guard';

@Resolver('${collectionName}')
export class ${collectionName}Resolver {
    constructor(private ${filename}Services: ${collectionName}Service,@Inject('PUB_SUB') private pubSub: PubSubEngine) {
    }

@Query('${filename}_queryOne')
    @UseGuards(GqlAuthGuard)
    async queryOne(
        @Args('query', { type: () => String }) query: string,
        @Args('data', { type: () => JSON }) data: any) {
        const _res = await this.${filename}Services.queryOne(query, data)
        return _res;
    }

    @Query('${filename}_queryMany')
    @UseGuards(GqlAuthGuard)
    async queryMany(
        @Args('query', { type: () => String }) query: string,
        @Args('data', { type: () => JSON }) data: any) {
        const _res = await this.${filename}Services.queryMany(query, data)
        return _res;
    }

    @Query('${filename}_aggregate')
    @UseGuards(GqlAuthGuard)
    async aggregate(
        @Args('query', { type: () => String }) query: string,
        @Args('data', { type: () => JSON }) data: any) {
        const _res = await this.${filename}Services.aggregate(query, data)
        return _res;
        }


@Subscription()
    ${filename}Added() {
        return this.pubSub.asyncIterator('${filename}Added');
    }

    @Subscription()
    ${filename}Updated() {
        return this.pubSub.asyncIterator('${filename}Updated');
    }

    @Subscription()
    ${filename}Deleted() {
        return this.pubSub.asyncIterator('${filename}Deleted');
    }

   @Mutation('${filename}_create')
    async createSite(@Args('data', { type: () => JSON }) data: any) {
        const ${filename} = await this.${filename}Services.create(data);
        this.pubSub.publish('${filename}Added', { ['${filename}Added']: ${filename} });
        return ${filename}
    }

@Mutation('${filename}_deleteOneById')
    @UseGuards(GqlAuthGuard)
    async ${filename}DeleteOneById(@Args('_id', { type: () => String }) _id: string) {
        const deleted = await this.${filename}Services.deleteOneById(_id);
        this.pubSub.publish('${filename}Deleted', { ['${filename}Deleted']: deleted });
        return deleted
    }

    @Mutation('${filename}_deleteBySID')
    @UseGuards(GqlAuthGuard)
    async ${filename}DeleteBySID(@Args('sid', { type: () => String }) sid: string) {
        const deleted = await this.${filename}Services.deleteBySID(sid);
        this.pubSub.publish('${filename}Deleted', { ['${filename}Deleted']: deleted });
        return deleted
    }

    @Mutation('${filename}_deleteByQuery')
    @UseGuards(GqlAuthGuard)
    async ${filename}DeleteByQuery(@Args('where', { type: () => JSON }) where: any) {
        const deleted = await this.${filename}Services.deleteByQuery(where);
        this.pubSub.publish('${filename}Deleted', { ['${filename}Deleted']: deleted });
        return deleted
    }


    @Mutation('${filename}_updateOne')
    @UseGuards(GqlAuthGuard)
    async updateOne(
        @Args('where', { type: () => JSON }) where: any,
        @Args('data', { type: () => JSON }) data: any) {
        const _res = this.${filename}Services.updateOne(where, data)
        this.pubSub.publish('${filename}Updated', { ['${filename}Updated']: _res });
        return _res;
    }

    @Mutation('${filename}_updateMany')
    @UseGuards(GqlAuthGuard)
    async updateMany(
        @Args('where', { type: () => JSON }) where: any,
        @Args('data', { type: () => JSON }) data: any) {
        const _res = this.${filename}Services.updateMany(where, data)
        this.pubSub.publish('${filename}Updated', { ['${filename}Updated']: _res });
        return _res;
    }


    @Query('${filename}')
    // @UseGuards(GqlAuthGuard)
    async getAll${collectionName}(
        @Args('first', { type: () => Int }) first: number,
        @Args('skip', { type: () => Int }) skip: number,
        @Args('where', { type: () => JSON }) where: any,
        @Args('sort', { type: () => JSON }) sort: any,
        @Args('aggregation', { type: () => JSON }) aggregation: any,
    ) {
        const _where = where ? JSON.parse(JSON.stringify(where).replace(/__/g, '$')) : null;
        const _sort = sort ? JSON.parse(JSON.stringify(sort).replace(/__/g, '$')) : null;
        const _aggregation = aggregation ? JSON.parse(JSON.stringify(aggregation).replace(/__/g, '$')) : null;

        return this.${filename}Services.findAll(first, skip, _where, _sort, _aggregation);
    }

   @Query('${filename}_findById')
    async get${collectionName}(@Args('_id', { type: () => String }) _id: string) {
        return this.${filename}Services.find(_id);
    }


    //@ResolveField('_domain')
    // @UseGuards(GqlAuthGuard)
    //async getDomain(@Parent() ${filename}) {
    //    const { _id } = ${filename};
    //    return this.domainsService.find(_id);
    //}

}`;
}
function getService(collectionName, filename) {
  return `import { Create${collectionName}Dto } from './dto/${filename}.dto';
import { Injectable } from '@nestjs/common';
import { ${collectionName} } from './schema/${filename}.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class ${collectionName}Service {

    constructor(@InjectModel(${collectionName}.name) private readonly ${filename}Model: Model<${collectionName}>) { }

    async create(create${collectionName}Dto: Create${collectionName}Dto): Promise<${collectionName}> {

        const created = new this.${filename}Model(create${collectionName}Dto);
        return created.save();
    }

    async queryOne(query: string, data: any): Promise<${collectionName}> {
        const moduleSpecifier = './queries/'+query+'.query'
        const Query = await import(moduleSpecifier)
        const _schema = new Query.default(data).schema;
        const _query = _schema.query;
        return this.${filename}Model.findOne(_query);
    }

    async queryMany(query: string, data: any): Promise<${collectionName}[]> {
        const moduleSpecifier = './queries/'+query+'.query'
        const Query = await import(moduleSpecifier)
        const _schema = new Query.default(data).schema;
        const _query = _schema.query;
        return this.${filename}Model.find(_query);
    }

    async aggregate(query: string, data: any): Promise<${collectionName}[]> {
        const moduleSpecifier = './queries/'+query+'.query'
        const Query = await import(moduleSpecifier)
        const _schema = new Query.default(data).schema;
        const _query = _schema.query;
        return this.${filename}Model.aggregate(_query);
    }

async deleteOneById(_id: string): Promise<any> {
        return this.${filename}Model.findByIdAndRemove(_id);
    }

    async deleteBySID(sid: string): Promise<any> {
        return this.${filename}Model.findAndRemove({ sid });
    }

    async deleteByQuery(where: any): Promise<any> {
        return this.${filename}Model.findAndRemove(where);
    }

    async updateOne(where: any, updates: any): Promise<${collectionName}> {

        return this.${filename}Model.findOneAndUpdate(where, updates, { upsert: false });
    }

    async updateMany(where: any, updates: any): Promise<${collectionName}> {

        return this.${filename}Model.findManyAndUpdate(where, updates, { upsert: false });
    }


        async findAll(first?: number, skip?: number, where?: any, sort?: any, aggregation?: any): Promise<${collectionName}[]> {
        if (aggregation) {
            return this.${filename}Model.aggregate(aggregation).exec();

        } else {
            return this.${filename}Model.find(where).limit(first).skip(skip).sort(sort).exec();

        }
    }


    async find(_id:string): Promise<${collectionName}> {

        return this.${filename}Model.find({_id}).exec();
    }

    async findByID(_id:string): Promise<${collectionName}> {

        return this.${filename}Model.find({_id}).exec();
    }

     async findBySID(_id:string): Promise<${collectionName}[]> {

        return this.${filename}Model.find({sid:_id}).exec();
    }

}`;
}

function loopback2nestGql(cb) {
  return src('common/models/*.json')
    .pipe(generateDtoAndSchemaFromjson())
    .pipe(
      rename(function (path) {
        var secondPath = ['dto', 'schema'].includes(path.basename.split('.')[1]) ? '/' + path.basename.split('.')[1] : '';
        path.dirname = path.basename.split('.')[0] + secondPath;
      })
    )
    .pipe(dest(`output/nest-gql`))
    .pipe(generateAppModule())
    .pipe(dest(`output/nest-gql`));
}

function loopback2nestAngularl(cb) {
  return src('common/models/*.json')
    .pipe(generateAngularApolloFromjson())
    .pipe(
      rename(function (path) {
        var secondPath = ['graphql', 'interface', 'service'].includes(path.basename.split('.')[1]) ? '/' + path.basename.split('.')[1] : '';
        path.dirname = secondPath ? secondPath : path.basename.split('.')[0];
      })
    )
    .pipe(dest(`output/ng-gql`))
    .pipe(generateGQLModule())
    .pipe(dest(`output/ng-gql`));
}
exports.default = series(loopback2nestGql, loopback2nestAngularl);
