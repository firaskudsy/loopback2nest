const {
    series,
    task
} = require('gulp');
const {
    src,
    dest
} = require('gulp');
var through = require('through2')


var rename = require("gulp-rename");

var path = require('path');

var File = require('vinyl');


var appModule = []

function generateDtoAndSchemaFromjson(collectionName, attributes) {
    'use strict';
    return through.obj(function (file, enc, next) {
        console.log('DEBUG: ~ file: gulpfile.js ~ line 24 ~ file', file);
        var mydata = JSON.parse(file.contents.toString('utf8'));
        var base = path.join(file.path, '..');
        var filename = path.basename(file.path, '.json');
        const collectionaAttributes = Object.entries(mydata).map((attribute) => {
            return {
                key: attribute[0],
                type: attribute[1].type
            };
        })
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


        var controllerFile = new File({
            base: base,
            path: path.join(base, filename + '.controller.ts'),
            contents: new Buffer(getController(mydata.name, filename))
        });
        this.push(controllerFile);

        appModule.push(`${mydata.name}Module`)
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

function getDTO(collectionName, attributes) {
    const generatedAttributes = attributes.map(attribute => {
        const type = attribute.type === 'array' ? 'object[]' : attribute.type;
        return `readonly ${attribute.key}: ${type};`
    }).join('\n')
    return `import * as mongoose from 'mongoose';
export class Create${collectionName}Dto {
     readonly _id: mongoose.Types.ObjectId;\n
    ${generatedAttributes}
}`
}


function getSchema(collectionName, attributes) {
    const generatedAttributes = attributes.map(attribute => {
        const type = attribute.type === 'array' ? 'object[]' : attribute.type;
        return `@Prop()\n${attribute.key}: ${type};\n`
    }).join('\n')
    return `import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ${collectionName} extends Document {

${generatedAttributes}
}

export const ${collectionName}Schema = SchemaFactory.createForClass(${collectionName});`
}

function getModule(collectionName, filename) {
    return `import { Module } from '@nestjs/common';
import { ${collectionName}Service } from './${filename}.service';
import { ${collectionName}Controller } from './${filename}.controller';
import { ${collectionName},  ${collectionName}Schema } from './schemas/${filename}.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
    imports: [MongooseModule.forFeature([{ name: ${collectionName}.name, schema:${collectionName}Schema, collection:${collectionName}.name }])],
  controllers: [${collectionName}Controller],

  providers: [${collectionName}Service]
})
export class ${collectionName}Module {}`
}

function getService(collectionName, filename) {
    return `import { Create${collectionName}Dto } from './dto/import { Create${collectionName}Dto } from './dto/${filename}.dtp';
import { Injectable } from '@nestjs/common';
import { ${collectionName} } from './schemas/${filename}.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class ${collectionName}Service {

    constructor(@InjectModel(${collectionName}.name) private readonly ${filename}Model: Model<${collectionName}>) { }

    async create(create${collectionName}Dto: Create${collectionName}Dto): Promise<${collectionName}> {
        const created = new this.${filename}Model(create${collectionName}Dto);
        return created.save();
    }

    async findAll(): Promise<${collectionName}[]> {

        return this.${filename}Model.find().exec();
    }



}.dtp';
import { Injectable } from '@nestjs/common';
import { ${collectionName} } from './schemas/${filename}.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class ${collectionName}Service {
    constructor(@InjectModel(${collectionName}.name) private readonly ${filename}Model: Model<${collectionName}>) { }

    async create(create${collectionName}Dto: Create${collectionName}Dto): Promise<${collectionName}> {
        const created = new this.${filename}Model(create${collectionName}Dto);
        return created.save();
    }

    async findAll(): Promise<${collectionName}[]> {
        return this.${filename}Model.find().exec();
    }
}`
}

function getController(collectionName, filename) {
    return `import { ${collectionName}Service } from './${filename}.service';
import { Controller, Post, Get, Body } from '@nestjs/common';
import { Create${collectionName}Dto } from './dto/${filename}.dtp';
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
        console.log(res)
        return res;
    }
}
`
}
task('loopback2nest', function () {
    return src('common/models/*.json')
        .pipe(generateDtoAndSchemaFromjson())
        .pipe(rename(function (path) {
            var secondPath = ['dto', 'schema'].includes(path.basename.split('.')[1]) ? '/' + path.basename.split('.')[1] : ''

            path.dirname = path.basename.split('.')[0] + secondPath;
            // path.basename += ".dto";
            // path.extname = ".ts";
        }))
        .pipe(require('gulp-filelist')('filelist.json'))

        .pipe(dest(`output/`));


});

function loopback2nest(cb) {
    return src('common/models/*.json')
        .pipe(generateDtoAndSchemaFromjson())
        .pipe(rename(function (path) {
            var secondPath = ['dto', 'schema'].includes(path.basename.split('.')[1]) ? '/' + path.basename.split('.')[1] : ''

            path.dirname = path.basename.split('.')[0] + secondPath;
            // path.basename += ".dto";
            // path.extname = ".ts";
        }))

        .pipe(dest(`output/`))
        .pipe(generateAppModule())
        .pipe(dest(`output/`));


}






exports.default = series(loopback2nest);