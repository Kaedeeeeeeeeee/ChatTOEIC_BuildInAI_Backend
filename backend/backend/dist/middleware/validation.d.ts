import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare const validateRequest: (schema: {
    body?: Joi.ObjectSchema;
    query?: Joi.ObjectSchema;
    params?: Joi.ObjectSchema;
}) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const schemas: {
    pagination: Joi.ObjectSchema<any>;
    userRegister: Joi.ObjectSchema<any>;
    userLogin: Joi.ObjectSchema<any>;
    questionGeneration: Joi.ObjectSchema<any>;
    practiceSubmission: Joi.ObjectSchema<any>;
    chatRequest: Joi.ObjectSchema<any>;
    vocabularyRequest: Joi.ObjectSchema<any>;
    idParam: Joi.ObjectSchema<any>;
};
