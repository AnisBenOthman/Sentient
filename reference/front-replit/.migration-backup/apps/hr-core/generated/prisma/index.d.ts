
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model EnumMeta
 * 
 */
export type EnumMeta = $Result.DefaultSelection<Prisma.$EnumMetaPayload>
/**
 * Model BusinessUnit
 * 
 */
export type BusinessUnit = $Result.DefaultSelection<Prisma.$BusinessUnitPayload>
/**
 * Model Department
 * 
 */
export type Department = $Result.DefaultSelection<Prisma.$DepartmentPayload>
/**
 * Model Team
 * 
 */
export type Team = $Result.DefaultSelection<Prisma.$TeamPayload>
/**
 * Model Position
 * 
 */
export type Position = $Result.DefaultSelection<Prisma.$PositionPayload>
/**
 * Model Employee
 * 
 */
export type Employee = $Result.DefaultSelection<Prisma.$EmployeePayload>
/**
 * Model SalaryHistory
 * 
 */
export type SalaryHistory = $Result.DefaultSelection<Prisma.$SalaryHistoryPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const EmploymentStatus: {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  PROBATION: 'PROBATION',
  TERMINATED: 'TERMINATED',
  RESIGNED: 'RESIGNED'
};

export type EmploymentStatus = (typeof EmploymentStatus)[keyof typeof EmploymentStatus]


export const ContractType: {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  INTERN: 'INTERN',
  CONTRACTOR: 'CONTRACTOR',
  FIXED_TERM: 'FIXED_TERM'
};

export type ContractType = (typeof ContractType)[keyof typeof ContractType]


export const MaritalStatus: {
  SINGLE: 'SINGLE',
  MARRIED: 'MARRIED',
  DIVORCED: 'DIVORCED',
  WIDOWED: 'WIDOWED'
};

export type MaritalStatus = (typeof MaritalStatus)[keyof typeof MaritalStatus]


export const EducationLevel: {
  BELOW_COLLEGE: 'BELOW_COLLEGE',
  COLLEGE: 'COLLEGE',
  BACHELOR: 'BACHELOR',
  MASTER: 'MASTER',
  DOCTOR: 'DOCTOR'
};

export type EducationLevel = (typeof EducationLevel)[keyof typeof EducationLevel]


export const PositionLevel: {
  JUNIOR: 'JUNIOR',
  MEDIUM: 'MEDIUM',
  CONFIRMED: 'CONFIRMED',
  SENIOR_1: 'SENIOR_1',
  SENIOR_2: 'SENIOR_2',
  EXPERT: 'EXPERT'
};

export type PositionLevel = (typeof PositionLevel)[keyof typeof PositionLevel]


export const SalaryChangeReason: {
  PROMOTION: 'PROMOTION',
  ANNUAL_REVIEW: 'ANNUAL_REVIEW',
  NEW_FUNCTION: 'NEW_FUNCTION',
  OTHER: 'OTHER'
};

export type SalaryChangeReason = (typeof SalaryChangeReason)[keyof typeof SalaryChangeReason]

}

export type EmploymentStatus = $Enums.EmploymentStatus

export const EmploymentStatus: typeof $Enums.EmploymentStatus

export type ContractType = $Enums.ContractType

export const ContractType: typeof $Enums.ContractType

export type MaritalStatus = $Enums.MaritalStatus

export const MaritalStatus: typeof $Enums.MaritalStatus

export type EducationLevel = $Enums.EducationLevel

export const EducationLevel: typeof $Enums.EducationLevel

export type PositionLevel = $Enums.PositionLevel

export const PositionLevel: typeof $Enums.PositionLevel

export type SalaryChangeReason = $Enums.SalaryChangeReason

export const SalaryChangeReason: typeof $Enums.SalaryChangeReason

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more EnumMetas
 * const enumMetas = await prisma.enumMeta.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more EnumMetas
   * const enumMetas = await prisma.enumMeta.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.enumMeta`: Exposes CRUD operations for the **EnumMeta** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more EnumMetas
    * const enumMetas = await prisma.enumMeta.findMany()
    * ```
    */
  get enumMeta(): Prisma.EnumMetaDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.businessUnit`: Exposes CRUD operations for the **BusinessUnit** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more BusinessUnits
    * const businessUnits = await prisma.businessUnit.findMany()
    * ```
    */
  get businessUnit(): Prisma.BusinessUnitDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.department`: Exposes CRUD operations for the **Department** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Departments
    * const departments = await prisma.department.findMany()
    * ```
    */
  get department(): Prisma.DepartmentDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.team`: Exposes CRUD operations for the **Team** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Teams
    * const teams = await prisma.team.findMany()
    * ```
    */
  get team(): Prisma.TeamDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.position`: Exposes CRUD operations for the **Position** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Positions
    * const positions = await prisma.position.findMany()
    * ```
    */
  get position(): Prisma.PositionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.employee`: Exposes CRUD operations for the **Employee** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Employees
    * const employees = await prisma.employee.findMany()
    * ```
    */
  get employee(): Prisma.EmployeeDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.salaryHistory`: Exposes CRUD operations for the **SalaryHistory** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SalaryHistories
    * const salaryHistories = await prisma.salaryHistory.findMany()
    * ```
    */
  get salaryHistory(): Prisma.SalaryHistoryDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.7.0
   * Query Engine version: 75cbdc1eb7150937890ad5465d861175c6624711
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    EnumMeta: 'EnumMeta',
    BusinessUnit: 'BusinessUnit',
    Department: 'Department',
    Team: 'Team',
    Position: 'Position',
    Employee: 'Employee',
    SalaryHistory: 'SalaryHistory'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "enumMeta" | "businessUnit" | "department" | "team" | "position" | "employee" | "salaryHistory"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      EnumMeta: {
        payload: Prisma.$EnumMetaPayload<ExtArgs>
        fields: Prisma.EnumMetaFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EnumMetaFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EnumMetaFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload>
          }
          findFirst: {
            args: Prisma.EnumMetaFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EnumMetaFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload>
          }
          findMany: {
            args: Prisma.EnumMetaFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload>[]
          }
          create: {
            args: Prisma.EnumMetaCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload>
          }
          createMany: {
            args: Prisma.EnumMetaCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EnumMetaCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload>[]
          }
          delete: {
            args: Prisma.EnumMetaDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload>
          }
          update: {
            args: Prisma.EnumMetaUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload>
          }
          deleteMany: {
            args: Prisma.EnumMetaDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EnumMetaUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.EnumMetaUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload>[]
          }
          upsert: {
            args: Prisma.EnumMetaUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EnumMetaPayload>
          }
          aggregate: {
            args: Prisma.EnumMetaAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEnumMeta>
          }
          groupBy: {
            args: Prisma.EnumMetaGroupByArgs<ExtArgs>
            result: $Utils.Optional<EnumMetaGroupByOutputType>[]
          }
          count: {
            args: Prisma.EnumMetaCountArgs<ExtArgs>
            result: $Utils.Optional<EnumMetaCountAggregateOutputType> | number
          }
        }
      }
      BusinessUnit: {
        payload: Prisma.$BusinessUnitPayload<ExtArgs>
        fields: Prisma.BusinessUnitFieldRefs
        operations: {
          findUnique: {
            args: Prisma.BusinessUnitFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.BusinessUnitFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload>
          }
          findFirst: {
            args: Prisma.BusinessUnitFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.BusinessUnitFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload>
          }
          findMany: {
            args: Prisma.BusinessUnitFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload>[]
          }
          create: {
            args: Prisma.BusinessUnitCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload>
          }
          createMany: {
            args: Prisma.BusinessUnitCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.BusinessUnitCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload>[]
          }
          delete: {
            args: Prisma.BusinessUnitDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload>
          }
          update: {
            args: Prisma.BusinessUnitUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload>
          }
          deleteMany: {
            args: Prisma.BusinessUnitDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.BusinessUnitUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.BusinessUnitUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload>[]
          }
          upsert: {
            args: Prisma.BusinessUnitUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BusinessUnitPayload>
          }
          aggregate: {
            args: Prisma.BusinessUnitAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateBusinessUnit>
          }
          groupBy: {
            args: Prisma.BusinessUnitGroupByArgs<ExtArgs>
            result: $Utils.Optional<BusinessUnitGroupByOutputType>[]
          }
          count: {
            args: Prisma.BusinessUnitCountArgs<ExtArgs>
            result: $Utils.Optional<BusinessUnitCountAggregateOutputType> | number
          }
        }
      }
      Department: {
        payload: Prisma.$DepartmentPayload<ExtArgs>
        fields: Prisma.DepartmentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DepartmentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DepartmentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          findFirst: {
            args: Prisma.DepartmentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DepartmentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          findMany: {
            args: Prisma.DepartmentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>[]
          }
          create: {
            args: Prisma.DepartmentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          createMany: {
            args: Prisma.DepartmentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DepartmentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>[]
          }
          delete: {
            args: Prisma.DepartmentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          update: {
            args: Prisma.DepartmentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          deleteMany: {
            args: Prisma.DepartmentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DepartmentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.DepartmentUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>[]
          }
          upsert: {
            args: Prisma.DepartmentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          aggregate: {
            args: Prisma.DepartmentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDepartment>
          }
          groupBy: {
            args: Prisma.DepartmentGroupByArgs<ExtArgs>
            result: $Utils.Optional<DepartmentGroupByOutputType>[]
          }
          count: {
            args: Prisma.DepartmentCountArgs<ExtArgs>
            result: $Utils.Optional<DepartmentCountAggregateOutputType> | number
          }
        }
      }
      Team: {
        payload: Prisma.$TeamPayload<ExtArgs>
        fields: Prisma.TeamFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TeamFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TeamFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          findFirst: {
            args: Prisma.TeamFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TeamFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          findMany: {
            args: Prisma.TeamFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>[]
          }
          create: {
            args: Prisma.TeamCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          createMany: {
            args: Prisma.TeamCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TeamCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>[]
          }
          delete: {
            args: Prisma.TeamDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          update: {
            args: Prisma.TeamUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          deleteMany: {
            args: Prisma.TeamDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TeamUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TeamUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>[]
          }
          upsert: {
            args: Prisma.TeamUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TeamPayload>
          }
          aggregate: {
            args: Prisma.TeamAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTeam>
          }
          groupBy: {
            args: Prisma.TeamGroupByArgs<ExtArgs>
            result: $Utils.Optional<TeamGroupByOutputType>[]
          }
          count: {
            args: Prisma.TeamCountArgs<ExtArgs>
            result: $Utils.Optional<TeamCountAggregateOutputType> | number
          }
        }
      }
      Position: {
        payload: Prisma.$PositionPayload<ExtArgs>
        fields: Prisma.PositionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PositionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PositionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload>
          }
          findFirst: {
            args: Prisma.PositionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PositionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload>
          }
          findMany: {
            args: Prisma.PositionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload>[]
          }
          create: {
            args: Prisma.PositionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload>
          }
          createMany: {
            args: Prisma.PositionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PositionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload>[]
          }
          delete: {
            args: Prisma.PositionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload>
          }
          update: {
            args: Prisma.PositionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload>
          }
          deleteMany: {
            args: Prisma.PositionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PositionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PositionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload>[]
          }
          upsert: {
            args: Prisma.PositionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PositionPayload>
          }
          aggregate: {
            args: Prisma.PositionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePosition>
          }
          groupBy: {
            args: Prisma.PositionGroupByArgs<ExtArgs>
            result: $Utils.Optional<PositionGroupByOutputType>[]
          }
          count: {
            args: Prisma.PositionCountArgs<ExtArgs>
            result: $Utils.Optional<PositionCountAggregateOutputType> | number
          }
        }
      }
      Employee: {
        payload: Prisma.$EmployeePayload<ExtArgs>
        fields: Prisma.EmployeeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EmployeeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EmployeeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          findFirst: {
            args: Prisma.EmployeeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EmployeeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          findMany: {
            args: Prisma.EmployeeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>[]
          }
          create: {
            args: Prisma.EmployeeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          createMany: {
            args: Prisma.EmployeeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EmployeeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>[]
          }
          delete: {
            args: Prisma.EmployeeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          update: {
            args: Prisma.EmployeeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          deleteMany: {
            args: Prisma.EmployeeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EmployeeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.EmployeeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>[]
          }
          upsert: {
            args: Prisma.EmployeeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EmployeePayload>
          }
          aggregate: {
            args: Prisma.EmployeeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEmployee>
          }
          groupBy: {
            args: Prisma.EmployeeGroupByArgs<ExtArgs>
            result: $Utils.Optional<EmployeeGroupByOutputType>[]
          }
          count: {
            args: Prisma.EmployeeCountArgs<ExtArgs>
            result: $Utils.Optional<EmployeeCountAggregateOutputType> | number
          }
        }
      }
      SalaryHistory: {
        payload: Prisma.$SalaryHistoryPayload<ExtArgs>
        fields: Prisma.SalaryHistoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SalaryHistoryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SalaryHistoryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload>
          }
          findFirst: {
            args: Prisma.SalaryHistoryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SalaryHistoryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload>
          }
          findMany: {
            args: Prisma.SalaryHistoryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload>[]
          }
          create: {
            args: Prisma.SalaryHistoryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload>
          }
          createMany: {
            args: Prisma.SalaryHistoryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SalaryHistoryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload>[]
          }
          delete: {
            args: Prisma.SalaryHistoryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload>
          }
          update: {
            args: Prisma.SalaryHistoryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload>
          }
          deleteMany: {
            args: Prisma.SalaryHistoryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SalaryHistoryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SalaryHistoryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload>[]
          }
          upsert: {
            args: Prisma.SalaryHistoryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SalaryHistoryPayload>
          }
          aggregate: {
            args: Prisma.SalaryHistoryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSalaryHistory>
          }
          groupBy: {
            args: Prisma.SalaryHistoryGroupByArgs<ExtArgs>
            result: $Utils.Optional<SalaryHistoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.SalaryHistoryCountArgs<ExtArgs>
            result: $Utils.Optional<SalaryHistoryCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    enumMeta?: EnumMetaOmit
    businessUnit?: BusinessUnitOmit
    department?: DepartmentOmit
    team?: TeamOmit
    position?: PositionOmit
    employee?: EmployeeOmit
    salaryHistory?: SalaryHistoryOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type BusinessUnitCountOutputType
   */

  export type BusinessUnitCountOutputType = {
    departments: number
  }

  export type BusinessUnitCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    departments?: boolean | BusinessUnitCountOutputTypeCountDepartmentsArgs
  }

  // Custom InputTypes
  /**
   * BusinessUnitCountOutputType without action
   */
  export type BusinessUnitCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnitCountOutputType
     */
    select?: BusinessUnitCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * BusinessUnitCountOutputType without action
   */
  export type BusinessUnitCountOutputTypeCountDepartmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DepartmentWhereInput
  }


  /**
   * Count Type DepartmentCountOutputType
   */

  export type DepartmentCountOutputType = {
    teams: number
    employees: number
  }

  export type DepartmentCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    teams?: boolean | DepartmentCountOutputTypeCountTeamsArgs
    employees?: boolean | DepartmentCountOutputTypeCountEmployeesArgs
  }

  // Custom InputTypes
  /**
   * DepartmentCountOutputType without action
   */
  export type DepartmentCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DepartmentCountOutputType
     */
    select?: DepartmentCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * DepartmentCountOutputType without action
   */
  export type DepartmentCountOutputTypeCountTeamsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamWhereInput
  }

  /**
   * DepartmentCountOutputType without action
   */
  export type DepartmentCountOutputTypeCountEmployeesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EmployeeWhereInput
  }


  /**
   * Count Type TeamCountOutputType
   */

  export type TeamCountOutputType = {
    employees: number
  }

  export type TeamCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employees?: boolean | TeamCountOutputTypeCountEmployeesArgs
  }

  // Custom InputTypes
  /**
   * TeamCountOutputType without action
   */
  export type TeamCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TeamCountOutputType
     */
    select?: TeamCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TeamCountOutputType without action
   */
  export type TeamCountOutputTypeCountEmployeesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EmployeeWhereInput
  }


  /**
   * Count Type PositionCountOutputType
   */

  export type PositionCountOutputType = {
    employees: number
  }

  export type PositionCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employees?: boolean | PositionCountOutputTypeCountEmployeesArgs
  }

  // Custom InputTypes
  /**
   * PositionCountOutputType without action
   */
  export type PositionCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PositionCountOutputType
     */
    select?: PositionCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PositionCountOutputType without action
   */
  export type PositionCountOutputTypeCountEmployeesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EmployeeWhereInput
  }


  /**
   * Count Type EmployeeCountOutputType
   */

  export type EmployeeCountOutputType = {
    directReports: number
    salaryHistory: number
  }

  export type EmployeeCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    directReports?: boolean | EmployeeCountOutputTypeCountDirectReportsArgs
    salaryHistory?: boolean | EmployeeCountOutputTypeCountSalaryHistoryArgs
  }

  // Custom InputTypes
  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmployeeCountOutputType
     */
    select?: EmployeeCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeCountDirectReportsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EmployeeWhereInput
  }

  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeCountSalaryHistoryArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SalaryHistoryWhereInput
  }


  /**
   * Models
   */

  /**
   * Model EnumMeta
   */

  export type AggregateEnumMeta = {
    _count: EnumMetaCountAggregateOutputType | null
    _avg: EnumMetaAvgAggregateOutputType | null
    _sum: EnumMetaSumAggregateOutputType | null
    _min: EnumMetaMinAggregateOutputType | null
    _max: EnumMetaMaxAggregateOutputType | null
  }

  export type EnumMetaAvgAggregateOutputType = {
    rank: number | null
  }

  export type EnumMetaSumAggregateOutputType = {
    rank: number | null
  }

  export type EnumMetaMinAggregateOutputType = {
    id: string | null
    enumName: string | null
    key: string | null
    rank: number | null
    label: string | null
  }

  export type EnumMetaMaxAggregateOutputType = {
    id: string | null
    enumName: string | null
    key: string | null
    rank: number | null
    label: string | null
  }

  export type EnumMetaCountAggregateOutputType = {
    id: number
    enumName: number
    key: number
    rank: number
    label: number
    _all: number
  }


  export type EnumMetaAvgAggregateInputType = {
    rank?: true
  }

  export type EnumMetaSumAggregateInputType = {
    rank?: true
  }

  export type EnumMetaMinAggregateInputType = {
    id?: true
    enumName?: true
    key?: true
    rank?: true
    label?: true
  }

  export type EnumMetaMaxAggregateInputType = {
    id?: true
    enumName?: true
    key?: true
    rank?: true
    label?: true
  }

  export type EnumMetaCountAggregateInputType = {
    id?: true
    enumName?: true
    key?: true
    rank?: true
    label?: true
    _all?: true
  }

  export type EnumMetaAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EnumMeta to aggregate.
     */
    where?: EnumMetaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EnumMetas to fetch.
     */
    orderBy?: EnumMetaOrderByWithRelationInput | EnumMetaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EnumMetaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EnumMetas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EnumMetas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned EnumMetas
    **/
    _count?: true | EnumMetaCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: EnumMetaAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: EnumMetaSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EnumMetaMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EnumMetaMaxAggregateInputType
  }

  export type GetEnumMetaAggregateType<T extends EnumMetaAggregateArgs> = {
        [P in keyof T & keyof AggregateEnumMeta]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEnumMeta[P]>
      : GetScalarType<T[P], AggregateEnumMeta[P]>
  }




  export type EnumMetaGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EnumMetaWhereInput
    orderBy?: EnumMetaOrderByWithAggregationInput | EnumMetaOrderByWithAggregationInput[]
    by: EnumMetaScalarFieldEnum[] | EnumMetaScalarFieldEnum
    having?: EnumMetaScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EnumMetaCountAggregateInputType | true
    _avg?: EnumMetaAvgAggregateInputType
    _sum?: EnumMetaSumAggregateInputType
    _min?: EnumMetaMinAggregateInputType
    _max?: EnumMetaMaxAggregateInputType
  }

  export type EnumMetaGroupByOutputType = {
    id: string
    enumName: string
    key: string
    rank: number
    label: string
    _count: EnumMetaCountAggregateOutputType | null
    _avg: EnumMetaAvgAggregateOutputType | null
    _sum: EnumMetaSumAggregateOutputType | null
    _min: EnumMetaMinAggregateOutputType | null
    _max: EnumMetaMaxAggregateOutputType | null
  }

  type GetEnumMetaGroupByPayload<T extends EnumMetaGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EnumMetaGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EnumMetaGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EnumMetaGroupByOutputType[P]>
            : GetScalarType<T[P], EnumMetaGroupByOutputType[P]>
        }
      >
    >


  export type EnumMetaSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    enumName?: boolean
    key?: boolean
    rank?: boolean
    label?: boolean
  }, ExtArgs["result"]["enumMeta"]>

  export type EnumMetaSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    enumName?: boolean
    key?: boolean
    rank?: boolean
    label?: boolean
  }, ExtArgs["result"]["enumMeta"]>

  export type EnumMetaSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    enumName?: boolean
    key?: boolean
    rank?: boolean
    label?: boolean
  }, ExtArgs["result"]["enumMeta"]>

  export type EnumMetaSelectScalar = {
    id?: boolean
    enumName?: boolean
    key?: boolean
    rank?: boolean
    label?: boolean
  }

  export type EnumMetaOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "enumName" | "key" | "rank" | "label", ExtArgs["result"]["enumMeta"]>

  export type $EnumMetaPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "EnumMeta"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      enumName: string
      key: string
      rank: number
      label: string
    }, ExtArgs["result"]["enumMeta"]>
    composites: {}
  }

  type EnumMetaGetPayload<S extends boolean | null | undefined | EnumMetaDefaultArgs> = $Result.GetResult<Prisma.$EnumMetaPayload, S>

  type EnumMetaCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<EnumMetaFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: EnumMetaCountAggregateInputType | true
    }

  export interface EnumMetaDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['EnumMeta'], meta: { name: 'EnumMeta' } }
    /**
     * Find zero or one EnumMeta that matches the filter.
     * @param {EnumMetaFindUniqueArgs} args - Arguments to find a EnumMeta
     * @example
     * // Get one EnumMeta
     * const enumMeta = await prisma.enumMeta.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EnumMetaFindUniqueArgs>(args: SelectSubset<T, EnumMetaFindUniqueArgs<ExtArgs>>): Prisma__EnumMetaClient<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one EnumMeta that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {EnumMetaFindUniqueOrThrowArgs} args - Arguments to find a EnumMeta
     * @example
     * // Get one EnumMeta
     * const enumMeta = await prisma.enumMeta.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EnumMetaFindUniqueOrThrowArgs>(args: SelectSubset<T, EnumMetaFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EnumMetaClient<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first EnumMeta that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnumMetaFindFirstArgs} args - Arguments to find a EnumMeta
     * @example
     * // Get one EnumMeta
     * const enumMeta = await prisma.enumMeta.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EnumMetaFindFirstArgs>(args?: SelectSubset<T, EnumMetaFindFirstArgs<ExtArgs>>): Prisma__EnumMetaClient<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first EnumMeta that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnumMetaFindFirstOrThrowArgs} args - Arguments to find a EnumMeta
     * @example
     * // Get one EnumMeta
     * const enumMeta = await prisma.enumMeta.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EnumMetaFindFirstOrThrowArgs>(args?: SelectSubset<T, EnumMetaFindFirstOrThrowArgs<ExtArgs>>): Prisma__EnumMetaClient<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more EnumMetas that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnumMetaFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all EnumMetas
     * const enumMetas = await prisma.enumMeta.findMany()
     * 
     * // Get first 10 EnumMetas
     * const enumMetas = await prisma.enumMeta.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const enumMetaWithIdOnly = await prisma.enumMeta.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends EnumMetaFindManyArgs>(args?: SelectSubset<T, EnumMetaFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a EnumMeta.
     * @param {EnumMetaCreateArgs} args - Arguments to create a EnumMeta.
     * @example
     * // Create one EnumMeta
     * const EnumMeta = await prisma.enumMeta.create({
     *   data: {
     *     // ... data to create a EnumMeta
     *   }
     * })
     * 
     */
    create<T extends EnumMetaCreateArgs>(args: SelectSubset<T, EnumMetaCreateArgs<ExtArgs>>): Prisma__EnumMetaClient<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many EnumMetas.
     * @param {EnumMetaCreateManyArgs} args - Arguments to create many EnumMetas.
     * @example
     * // Create many EnumMetas
     * const enumMeta = await prisma.enumMeta.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EnumMetaCreateManyArgs>(args?: SelectSubset<T, EnumMetaCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many EnumMetas and returns the data saved in the database.
     * @param {EnumMetaCreateManyAndReturnArgs} args - Arguments to create many EnumMetas.
     * @example
     * // Create many EnumMetas
     * const enumMeta = await prisma.enumMeta.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many EnumMetas and only return the `id`
     * const enumMetaWithIdOnly = await prisma.enumMeta.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EnumMetaCreateManyAndReturnArgs>(args?: SelectSubset<T, EnumMetaCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a EnumMeta.
     * @param {EnumMetaDeleteArgs} args - Arguments to delete one EnumMeta.
     * @example
     * // Delete one EnumMeta
     * const EnumMeta = await prisma.enumMeta.delete({
     *   where: {
     *     // ... filter to delete one EnumMeta
     *   }
     * })
     * 
     */
    delete<T extends EnumMetaDeleteArgs>(args: SelectSubset<T, EnumMetaDeleteArgs<ExtArgs>>): Prisma__EnumMetaClient<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one EnumMeta.
     * @param {EnumMetaUpdateArgs} args - Arguments to update one EnumMeta.
     * @example
     * // Update one EnumMeta
     * const enumMeta = await prisma.enumMeta.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EnumMetaUpdateArgs>(args: SelectSubset<T, EnumMetaUpdateArgs<ExtArgs>>): Prisma__EnumMetaClient<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more EnumMetas.
     * @param {EnumMetaDeleteManyArgs} args - Arguments to filter EnumMetas to delete.
     * @example
     * // Delete a few EnumMetas
     * const { count } = await prisma.enumMeta.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EnumMetaDeleteManyArgs>(args?: SelectSubset<T, EnumMetaDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EnumMetas.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnumMetaUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many EnumMetas
     * const enumMeta = await prisma.enumMeta.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EnumMetaUpdateManyArgs>(args: SelectSubset<T, EnumMetaUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EnumMetas and returns the data updated in the database.
     * @param {EnumMetaUpdateManyAndReturnArgs} args - Arguments to update many EnumMetas.
     * @example
     * // Update many EnumMetas
     * const enumMeta = await prisma.enumMeta.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more EnumMetas and only return the `id`
     * const enumMetaWithIdOnly = await prisma.enumMeta.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends EnumMetaUpdateManyAndReturnArgs>(args: SelectSubset<T, EnumMetaUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one EnumMeta.
     * @param {EnumMetaUpsertArgs} args - Arguments to update or create a EnumMeta.
     * @example
     * // Update or create a EnumMeta
     * const enumMeta = await prisma.enumMeta.upsert({
     *   create: {
     *     // ... data to create a EnumMeta
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the EnumMeta we want to update
     *   }
     * })
     */
    upsert<T extends EnumMetaUpsertArgs>(args: SelectSubset<T, EnumMetaUpsertArgs<ExtArgs>>): Prisma__EnumMetaClient<$Result.GetResult<Prisma.$EnumMetaPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of EnumMetas.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnumMetaCountArgs} args - Arguments to filter EnumMetas to count.
     * @example
     * // Count the number of EnumMetas
     * const count = await prisma.enumMeta.count({
     *   where: {
     *     // ... the filter for the EnumMetas we want to count
     *   }
     * })
    **/
    count<T extends EnumMetaCountArgs>(
      args?: Subset<T, EnumMetaCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EnumMetaCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a EnumMeta.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnumMetaAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EnumMetaAggregateArgs>(args: Subset<T, EnumMetaAggregateArgs>): Prisma.PrismaPromise<GetEnumMetaAggregateType<T>>

    /**
     * Group by EnumMeta.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnumMetaGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EnumMetaGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EnumMetaGroupByArgs['orderBy'] }
        : { orderBy?: EnumMetaGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EnumMetaGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEnumMetaGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the EnumMeta model
   */
  readonly fields: EnumMetaFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for EnumMeta.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EnumMetaClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the EnumMeta model
   */
  interface EnumMetaFieldRefs {
    readonly id: FieldRef<"EnumMeta", 'String'>
    readonly enumName: FieldRef<"EnumMeta", 'String'>
    readonly key: FieldRef<"EnumMeta", 'String'>
    readonly rank: FieldRef<"EnumMeta", 'Int'>
    readonly label: FieldRef<"EnumMeta", 'String'>
  }
    

  // Custom InputTypes
  /**
   * EnumMeta findUnique
   */
  export type EnumMetaFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * Filter, which EnumMeta to fetch.
     */
    where: EnumMetaWhereUniqueInput
  }

  /**
   * EnumMeta findUniqueOrThrow
   */
  export type EnumMetaFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * Filter, which EnumMeta to fetch.
     */
    where: EnumMetaWhereUniqueInput
  }

  /**
   * EnumMeta findFirst
   */
  export type EnumMetaFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * Filter, which EnumMeta to fetch.
     */
    where?: EnumMetaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EnumMetas to fetch.
     */
    orderBy?: EnumMetaOrderByWithRelationInput | EnumMetaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EnumMetas.
     */
    cursor?: EnumMetaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EnumMetas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EnumMetas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EnumMetas.
     */
    distinct?: EnumMetaScalarFieldEnum | EnumMetaScalarFieldEnum[]
  }

  /**
   * EnumMeta findFirstOrThrow
   */
  export type EnumMetaFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * Filter, which EnumMeta to fetch.
     */
    where?: EnumMetaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EnumMetas to fetch.
     */
    orderBy?: EnumMetaOrderByWithRelationInput | EnumMetaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EnumMetas.
     */
    cursor?: EnumMetaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EnumMetas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EnumMetas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EnumMetas.
     */
    distinct?: EnumMetaScalarFieldEnum | EnumMetaScalarFieldEnum[]
  }

  /**
   * EnumMeta findMany
   */
  export type EnumMetaFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * Filter, which EnumMetas to fetch.
     */
    where?: EnumMetaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EnumMetas to fetch.
     */
    orderBy?: EnumMetaOrderByWithRelationInput | EnumMetaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing EnumMetas.
     */
    cursor?: EnumMetaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EnumMetas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EnumMetas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EnumMetas.
     */
    distinct?: EnumMetaScalarFieldEnum | EnumMetaScalarFieldEnum[]
  }

  /**
   * EnumMeta create
   */
  export type EnumMetaCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * The data needed to create a EnumMeta.
     */
    data: XOR<EnumMetaCreateInput, EnumMetaUncheckedCreateInput>
  }

  /**
   * EnumMeta createMany
   */
  export type EnumMetaCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many EnumMetas.
     */
    data: EnumMetaCreateManyInput | EnumMetaCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * EnumMeta createManyAndReturn
   */
  export type EnumMetaCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * The data used to create many EnumMetas.
     */
    data: EnumMetaCreateManyInput | EnumMetaCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * EnumMeta update
   */
  export type EnumMetaUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * The data needed to update a EnumMeta.
     */
    data: XOR<EnumMetaUpdateInput, EnumMetaUncheckedUpdateInput>
    /**
     * Choose, which EnumMeta to update.
     */
    where: EnumMetaWhereUniqueInput
  }

  /**
   * EnumMeta updateMany
   */
  export type EnumMetaUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update EnumMetas.
     */
    data: XOR<EnumMetaUpdateManyMutationInput, EnumMetaUncheckedUpdateManyInput>
    /**
     * Filter which EnumMetas to update
     */
    where?: EnumMetaWhereInput
    /**
     * Limit how many EnumMetas to update.
     */
    limit?: number
  }

  /**
   * EnumMeta updateManyAndReturn
   */
  export type EnumMetaUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * The data used to update EnumMetas.
     */
    data: XOR<EnumMetaUpdateManyMutationInput, EnumMetaUncheckedUpdateManyInput>
    /**
     * Filter which EnumMetas to update
     */
    where?: EnumMetaWhereInput
    /**
     * Limit how many EnumMetas to update.
     */
    limit?: number
  }

  /**
   * EnumMeta upsert
   */
  export type EnumMetaUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * The filter to search for the EnumMeta to update in case it exists.
     */
    where: EnumMetaWhereUniqueInput
    /**
     * In case the EnumMeta found by the `where` argument doesn't exist, create a new EnumMeta with this data.
     */
    create: XOR<EnumMetaCreateInput, EnumMetaUncheckedCreateInput>
    /**
     * In case the EnumMeta was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EnumMetaUpdateInput, EnumMetaUncheckedUpdateInput>
  }

  /**
   * EnumMeta delete
   */
  export type EnumMetaDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
    /**
     * Filter which EnumMeta to delete.
     */
    where: EnumMetaWhereUniqueInput
  }

  /**
   * EnumMeta deleteMany
   */
  export type EnumMetaDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EnumMetas to delete
     */
    where?: EnumMetaWhereInput
    /**
     * Limit how many EnumMetas to delete.
     */
    limit?: number
  }

  /**
   * EnumMeta without action
   */
  export type EnumMetaDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnumMeta
     */
    select?: EnumMetaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EnumMeta
     */
    omit?: EnumMetaOmit<ExtArgs> | null
  }


  /**
   * Model BusinessUnit
   */

  export type AggregateBusinessUnit = {
    _count: BusinessUnitCountAggregateOutputType | null
    _min: BusinessUnitMinAggregateOutputType | null
    _max: BusinessUnitMaxAggregateOutputType | null
  }

  export type BusinessUnitMinAggregateOutputType = {
    id: string | null
    name: string | null
    address: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BusinessUnitMaxAggregateOutputType = {
    id: string | null
    name: string | null
    address: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BusinessUnitCountAggregateOutputType = {
    id: number
    name: number
    address: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type BusinessUnitMinAggregateInputType = {
    id?: true
    name?: true
    address?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BusinessUnitMaxAggregateInputType = {
    id?: true
    name?: true
    address?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BusinessUnitCountAggregateInputType = {
    id?: true
    name?: true
    address?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type BusinessUnitAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which BusinessUnit to aggregate.
     */
    where?: BusinessUnitWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BusinessUnits to fetch.
     */
    orderBy?: BusinessUnitOrderByWithRelationInput | BusinessUnitOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: BusinessUnitWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BusinessUnits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BusinessUnits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned BusinessUnits
    **/
    _count?: true | BusinessUnitCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: BusinessUnitMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: BusinessUnitMaxAggregateInputType
  }

  export type GetBusinessUnitAggregateType<T extends BusinessUnitAggregateArgs> = {
        [P in keyof T & keyof AggregateBusinessUnit]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateBusinessUnit[P]>
      : GetScalarType<T[P], AggregateBusinessUnit[P]>
  }




  export type BusinessUnitGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BusinessUnitWhereInput
    orderBy?: BusinessUnitOrderByWithAggregationInput | BusinessUnitOrderByWithAggregationInput[]
    by: BusinessUnitScalarFieldEnum[] | BusinessUnitScalarFieldEnum
    having?: BusinessUnitScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: BusinessUnitCountAggregateInputType | true
    _min?: BusinessUnitMinAggregateInputType
    _max?: BusinessUnitMaxAggregateInputType
  }

  export type BusinessUnitGroupByOutputType = {
    id: string
    name: string
    address: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: BusinessUnitCountAggregateOutputType | null
    _min: BusinessUnitMinAggregateOutputType | null
    _max: BusinessUnitMaxAggregateOutputType | null
  }

  type GetBusinessUnitGroupByPayload<T extends BusinessUnitGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<BusinessUnitGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof BusinessUnitGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], BusinessUnitGroupByOutputType[P]>
            : GetScalarType<T[P], BusinessUnitGroupByOutputType[P]>
        }
      >
    >


  export type BusinessUnitSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    address?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    departments?: boolean | BusinessUnit$departmentsArgs<ExtArgs>
    _count?: boolean | BusinessUnitCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["businessUnit"]>

  export type BusinessUnitSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    address?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["businessUnit"]>

  export type BusinessUnitSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    address?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["businessUnit"]>

  export type BusinessUnitSelectScalar = {
    id?: boolean
    name?: boolean
    address?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type BusinessUnitOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "address" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["businessUnit"]>
  export type BusinessUnitInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    departments?: boolean | BusinessUnit$departmentsArgs<ExtArgs>
    _count?: boolean | BusinessUnitCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type BusinessUnitIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type BusinessUnitIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $BusinessUnitPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "BusinessUnit"
    objects: {
      departments: Prisma.$DepartmentPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      address: string
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["businessUnit"]>
    composites: {}
  }

  type BusinessUnitGetPayload<S extends boolean | null | undefined | BusinessUnitDefaultArgs> = $Result.GetResult<Prisma.$BusinessUnitPayload, S>

  type BusinessUnitCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<BusinessUnitFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: BusinessUnitCountAggregateInputType | true
    }

  export interface BusinessUnitDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['BusinessUnit'], meta: { name: 'BusinessUnit' } }
    /**
     * Find zero or one BusinessUnit that matches the filter.
     * @param {BusinessUnitFindUniqueArgs} args - Arguments to find a BusinessUnit
     * @example
     * // Get one BusinessUnit
     * const businessUnit = await prisma.businessUnit.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends BusinessUnitFindUniqueArgs>(args: SelectSubset<T, BusinessUnitFindUniqueArgs<ExtArgs>>): Prisma__BusinessUnitClient<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one BusinessUnit that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {BusinessUnitFindUniqueOrThrowArgs} args - Arguments to find a BusinessUnit
     * @example
     * // Get one BusinessUnit
     * const businessUnit = await prisma.businessUnit.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends BusinessUnitFindUniqueOrThrowArgs>(args: SelectSubset<T, BusinessUnitFindUniqueOrThrowArgs<ExtArgs>>): Prisma__BusinessUnitClient<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first BusinessUnit that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BusinessUnitFindFirstArgs} args - Arguments to find a BusinessUnit
     * @example
     * // Get one BusinessUnit
     * const businessUnit = await prisma.businessUnit.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends BusinessUnitFindFirstArgs>(args?: SelectSubset<T, BusinessUnitFindFirstArgs<ExtArgs>>): Prisma__BusinessUnitClient<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first BusinessUnit that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BusinessUnitFindFirstOrThrowArgs} args - Arguments to find a BusinessUnit
     * @example
     * // Get one BusinessUnit
     * const businessUnit = await prisma.businessUnit.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends BusinessUnitFindFirstOrThrowArgs>(args?: SelectSubset<T, BusinessUnitFindFirstOrThrowArgs<ExtArgs>>): Prisma__BusinessUnitClient<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more BusinessUnits that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BusinessUnitFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all BusinessUnits
     * const businessUnits = await prisma.businessUnit.findMany()
     * 
     * // Get first 10 BusinessUnits
     * const businessUnits = await prisma.businessUnit.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const businessUnitWithIdOnly = await prisma.businessUnit.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends BusinessUnitFindManyArgs>(args?: SelectSubset<T, BusinessUnitFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a BusinessUnit.
     * @param {BusinessUnitCreateArgs} args - Arguments to create a BusinessUnit.
     * @example
     * // Create one BusinessUnit
     * const BusinessUnit = await prisma.businessUnit.create({
     *   data: {
     *     // ... data to create a BusinessUnit
     *   }
     * })
     * 
     */
    create<T extends BusinessUnitCreateArgs>(args: SelectSubset<T, BusinessUnitCreateArgs<ExtArgs>>): Prisma__BusinessUnitClient<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many BusinessUnits.
     * @param {BusinessUnitCreateManyArgs} args - Arguments to create many BusinessUnits.
     * @example
     * // Create many BusinessUnits
     * const businessUnit = await prisma.businessUnit.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends BusinessUnitCreateManyArgs>(args?: SelectSubset<T, BusinessUnitCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many BusinessUnits and returns the data saved in the database.
     * @param {BusinessUnitCreateManyAndReturnArgs} args - Arguments to create many BusinessUnits.
     * @example
     * // Create many BusinessUnits
     * const businessUnit = await prisma.businessUnit.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many BusinessUnits and only return the `id`
     * const businessUnitWithIdOnly = await prisma.businessUnit.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends BusinessUnitCreateManyAndReturnArgs>(args?: SelectSubset<T, BusinessUnitCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a BusinessUnit.
     * @param {BusinessUnitDeleteArgs} args - Arguments to delete one BusinessUnit.
     * @example
     * // Delete one BusinessUnit
     * const BusinessUnit = await prisma.businessUnit.delete({
     *   where: {
     *     // ... filter to delete one BusinessUnit
     *   }
     * })
     * 
     */
    delete<T extends BusinessUnitDeleteArgs>(args: SelectSubset<T, BusinessUnitDeleteArgs<ExtArgs>>): Prisma__BusinessUnitClient<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one BusinessUnit.
     * @param {BusinessUnitUpdateArgs} args - Arguments to update one BusinessUnit.
     * @example
     * // Update one BusinessUnit
     * const businessUnit = await prisma.businessUnit.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends BusinessUnitUpdateArgs>(args: SelectSubset<T, BusinessUnitUpdateArgs<ExtArgs>>): Prisma__BusinessUnitClient<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more BusinessUnits.
     * @param {BusinessUnitDeleteManyArgs} args - Arguments to filter BusinessUnits to delete.
     * @example
     * // Delete a few BusinessUnits
     * const { count } = await prisma.businessUnit.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends BusinessUnitDeleteManyArgs>(args?: SelectSubset<T, BusinessUnitDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more BusinessUnits.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BusinessUnitUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many BusinessUnits
     * const businessUnit = await prisma.businessUnit.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends BusinessUnitUpdateManyArgs>(args: SelectSubset<T, BusinessUnitUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more BusinessUnits and returns the data updated in the database.
     * @param {BusinessUnitUpdateManyAndReturnArgs} args - Arguments to update many BusinessUnits.
     * @example
     * // Update many BusinessUnits
     * const businessUnit = await prisma.businessUnit.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more BusinessUnits and only return the `id`
     * const businessUnitWithIdOnly = await prisma.businessUnit.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends BusinessUnitUpdateManyAndReturnArgs>(args: SelectSubset<T, BusinessUnitUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one BusinessUnit.
     * @param {BusinessUnitUpsertArgs} args - Arguments to update or create a BusinessUnit.
     * @example
     * // Update or create a BusinessUnit
     * const businessUnit = await prisma.businessUnit.upsert({
     *   create: {
     *     // ... data to create a BusinessUnit
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the BusinessUnit we want to update
     *   }
     * })
     */
    upsert<T extends BusinessUnitUpsertArgs>(args: SelectSubset<T, BusinessUnitUpsertArgs<ExtArgs>>): Prisma__BusinessUnitClient<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of BusinessUnits.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BusinessUnitCountArgs} args - Arguments to filter BusinessUnits to count.
     * @example
     * // Count the number of BusinessUnits
     * const count = await prisma.businessUnit.count({
     *   where: {
     *     // ... the filter for the BusinessUnits we want to count
     *   }
     * })
    **/
    count<T extends BusinessUnitCountArgs>(
      args?: Subset<T, BusinessUnitCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], BusinessUnitCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a BusinessUnit.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BusinessUnitAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends BusinessUnitAggregateArgs>(args: Subset<T, BusinessUnitAggregateArgs>): Prisma.PrismaPromise<GetBusinessUnitAggregateType<T>>

    /**
     * Group by BusinessUnit.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BusinessUnitGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends BusinessUnitGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: BusinessUnitGroupByArgs['orderBy'] }
        : { orderBy?: BusinessUnitGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, BusinessUnitGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBusinessUnitGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the BusinessUnit model
   */
  readonly fields: BusinessUnitFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for BusinessUnit.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__BusinessUnitClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    departments<T extends BusinessUnit$departmentsArgs<ExtArgs> = {}>(args?: Subset<T, BusinessUnit$departmentsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the BusinessUnit model
   */
  interface BusinessUnitFieldRefs {
    readonly id: FieldRef<"BusinessUnit", 'String'>
    readonly name: FieldRef<"BusinessUnit", 'String'>
    readonly address: FieldRef<"BusinessUnit", 'String'>
    readonly isActive: FieldRef<"BusinessUnit", 'Boolean'>
    readonly createdAt: FieldRef<"BusinessUnit", 'DateTime'>
    readonly updatedAt: FieldRef<"BusinessUnit", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * BusinessUnit findUnique
   */
  export type BusinessUnitFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    /**
     * Filter, which BusinessUnit to fetch.
     */
    where: BusinessUnitWhereUniqueInput
  }

  /**
   * BusinessUnit findUniqueOrThrow
   */
  export type BusinessUnitFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    /**
     * Filter, which BusinessUnit to fetch.
     */
    where: BusinessUnitWhereUniqueInput
  }

  /**
   * BusinessUnit findFirst
   */
  export type BusinessUnitFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    /**
     * Filter, which BusinessUnit to fetch.
     */
    where?: BusinessUnitWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BusinessUnits to fetch.
     */
    orderBy?: BusinessUnitOrderByWithRelationInput | BusinessUnitOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for BusinessUnits.
     */
    cursor?: BusinessUnitWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BusinessUnits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BusinessUnits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BusinessUnits.
     */
    distinct?: BusinessUnitScalarFieldEnum | BusinessUnitScalarFieldEnum[]
  }

  /**
   * BusinessUnit findFirstOrThrow
   */
  export type BusinessUnitFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    /**
     * Filter, which BusinessUnit to fetch.
     */
    where?: BusinessUnitWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BusinessUnits to fetch.
     */
    orderBy?: BusinessUnitOrderByWithRelationInput | BusinessUnitOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for BusinessUnits.
     */
    cursor?: BusinessUnitWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BusinessUnits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BusinessUnits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BusinessUnits.
     */
    distinct?: BusinessUnitScalarFieldEnum | BusinessUnitScalarFieldEnum[]
  }

  /**
   * BusinessUnit findMany
   */
  export type BusinessUnitFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    /**
     * Filter, which BusinessUnits to fetch.
     */
    where?: BusinessUnitWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BusinessUnits to fetch.
     */
    orderBy?: BusinessUnitOrderByWithRelationInput | BusinessUnitOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing BusinessUnits.
     */
    cursor?: BusinessUnitWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BusinessUnits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BusinessUnits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BusinessUnits.
     */
    distinct?: BusinessUnitScalarFieldEnum | BusinessUnitScalarFieldEnum[]
  }

  /**
   * BusinessUnit create
   */
  export type BusinessUnitCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    /**
     * The data needed to create a BusinessUnit.
     */
    data: XOR<BusinessUnitCreateInput, BusinessUnitUncheckedCreateInput>
  }

  /**
   * BusinessUnit createMany
   */
  export type BusinessUnitCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many BusinessUnits.
     */
    data: BusinessUnitCreateManyInput | BusinessUnitCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * BusinessUnit createManyAndReturn
   */
  export type BusinessUnitCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * The data used to create many BusinessUnits.
     */
    data: BusinessUnitCreateManyInput | BusinessUnitCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * BusinessUnit update
   */
  export type BusinessUnitUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    /**
     * The data needed to update a BusinessUnit.
     */
    data: XOR<BusinessUnitUpdateInput, BusinessUnitUncheckedUpdateInput>
    /**
     * Choose, which BusinessUnit to update.
     */
    where: BusinessUnitWhereUniqueInput
  }

  /**
   * BusinessUnit updateMany
   */
  export type BusinessUnitUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update BusinessUnits.
     */
    data: XOR<BusinessUnitUpdateManyMutationInput, BusinessUnitUncheckedUpdateManyInput>
    /**
     * Filter which BusinessUnits to update
     */
    where?: BusinessUnitWhereInput
    /**
     * Limit how many BusinessUnits to update.
     */
    limit?: number
  }

  /**
   * BusinessUnit updateManyAndReturn
   */
  export type BusinessUnitUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * The data used to update BusinessUnits.
     */
    data: XOR<BusinessUnitUpdateManyMutationInput, BusinessUnitUncheckedUpdateManyInput>
    /**
     * Filter which BusinessUnits to update
     */
    where?: BusinessUnitWhereInput
    /**
     * Limit how many BusinessUnits to update.
     */
    limit?: number
  }

  /**
   * BusinessUnit upsert
   */
  export type BusinessUnitUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    /**
     * The filter to search for the BusinessUnit to update in case it exists.
     */
    where: BusinessUnitWhereUniqueInput
    /**
     * In case the BusinessUnit found by the `where` argument doesn't exist, create a new BusinessUnit with this data.
     */
    create: XOR<BusinessUnitCreateInput, BusinessUnitUncheckedCreateInput>
    /**
     * In case the BusinessUnit was found with the provided `where` argument, update it with this data.
     */
    update: XOR<BusinessUnitUpdateInput, BusinessUnitUncheckedUpdateInput>
  }

  /**
   * BusinessUnit delete
   */
  export type BusinessUnitDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    /**
     * Filter which BusinessUnit to delete.
     */
    where: BusinessUnitWhereUniqueInput
  }

  /**
   * BusinessUnit deleteMany
   */
  export type BusinessUnitDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which BusinessUnits to delete
     */
    where?: BusinessUnitWhereInput
    /**
     * Limit how many BusinessUnits to delete.
     */
    limit?: number
  }

  /**
   * BusinessUnit.departments
   */
  export type BusinessUnit$departmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    where?: DepartmentWhereInput
    orderBy?: DepartmentOrderByWithRelationInput | DepartmentOrderByWithRelationInput[]
    cursor?: DepartmentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: DepartmentScalarFieldEnum | DepartmentScalarFieldEnum[]
  }

  /**
   * BusinessUnit without action
   */
  export type BusinessUnitDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
  }


  /**
   * Model Department
   */

  export type AggregateDepartment = {
    _count: DepartmentCountAggregateOutputType | null
    _min: DepartmentMinAggregateOutputType | null
    _max: DepartmentMaxAggregateOutputType | null
  }

  export type DepartmentMinAggregateOutputType = {
    id: string | null
    name: string | null
    code: string | null
    description: string | null
    headId: string | null
    businessUnitId: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type DepartmentMaxAggregateOutputType = {
    id: string | null
    name: string | null
    code: string | null
    description: string | null
    headId: string | null
    businessUnitId: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type DepartmentCountAggregateOutputType = {
    id: number
    name: number
    code: number
    description: number
    headId: number
    businessUnitId: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type DepartmentMinAggregateInputType = {
    id?: true
    name?: true
    code?: true
    description?: true
    headId?: true
    businessUnitId?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type DepartmentMaxAggregateInputType = {
    id?: true
    name?: true
    code?: true
    description?: true
    headId?: true
    businessUnitId?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type DepartmentCountAggregateInputType = {
    id?: true
    name?: true
    code?: true
    description?: true
    headId?: true
    businessUnitId?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type DepartmentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Department to aggregate.
     */
    where?: DepartmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Departments to fetch.
     */
    orderBy?: DepartmentOrderByWithRelationInput | DepartmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DepartmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Departments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Departments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Departments
    **/
    _count?: true | DepartmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DepartmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DepartmentMaxAggregateInputType
  }

  export type GetDepartmentAggregateType<T extends DepartmentAggregateArgs> = {
        [P in keyof T & keyof AggregateDepartment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDepartment[P]>
      : GetScalarType<T[P], AggregateDepartment[P]>
  }




  export type DepartmentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DepartmentWhereInput
    orderBy?: DepartmentOrderByWithAggregationInput | DepartmentOrderByWithAggregationInput[]
    by: DepartmentScalarFieldEnum[] | DepartmentScalarFieldEnum
    having?: DepartmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DepartmentCountAggregateInputType | true
    _min?: DepartmentMinAggregateInputType
    _max?: DepartmentMaxAggregateInputType
  }

  export type DepartmentGroupByOutputType = {
    id: string
    name: string
    code: string
    description: string | null
    headId: string | null
    businessUnitId: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: DepartmentCountAggregateOutputType | null
    _min: DepartmentMinAggregateOutputType | null
    _max: DepartmentMaxAggregateOutputType | null
  }

  type GetDepartmentGroupByPayload<T extends DepartmentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DepartmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DepartmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DepartmentGroupByOutputType[P]>
            : GetScalarType<T[P], DepartmentGroupByOutputType[P]>
        }
      >
    >


  export type DepartmentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    code?: boolean
    description?: boolean
    headId?: boolean
    businessUnitId?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    businessUnit?: boolean | Department$businessUnitArgs<ExtArgs>
    teams?: boolean | Department$teamsArgs<ExtArgs>
    employees?: boolean | Department$employeesArgs<ExtArgs>
    _count?: boolean | DepartmentCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["department"]>

  export type DepartmentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    code?: boolean
    description?: boolean
    headId?: boolean
    businessUnitId?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    businessUnit?: boolean | Department$businessUnitArgs<ExtArgs>
  }, ExtArgs["result"]["department"]>

  export type DepartmentSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    code?: boolean
    description?: boolean
    headId?: boolean
    businessUnitId?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    businessUnit?: boolean | Department$businessUnitArgs<ExtArgs>
  }, ExtArgs["result"]["department"]>

  export type DepartmentSelectScalar = {
    id?: boolean
    name?: boolean
    code?: boolean
    description?: boolean
    headId?: boolean
    businessUnitId?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type DepartmentOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "code" | "description" | "headId" | "businessUnitId" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["department"]>
  export type DepartmentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    businessUnit?: boolean | Department$businessUnitArgs<ExtArgs>
    teams?: boolean | Department$teamsArgs<ExtArgs>
    employees?: boolean | Department$employeesArgs<ExtArgs>
    _count?: boolean | DepartmentCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type DepartmentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    businessUnit?: boolean | Department$businessUnitArgs<ExtArgs>
  }
  export type DepartmentIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    businessUnit?: boolean | Department$businessUnitArgs<ExtArgs>
  }

  export type $DepartmentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Department"
    objects: {
      businessUnit: Prisma.$BusinessUnitPayload<ExtArgs> | null
      teams: Prisma.$TeamPayload<ExtArgs>[]
      employees: Prisma.$EmployeePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      code: string
      description: string | null
      headId: string | null
      businessUnitId: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["department"]>
    composites: {}
  }

  type DepartmentGetPayload<S extends boolean | null | undefined | DepartmentDefaultArgs> = $Result.GetResult<Prisma.$DepartmentPayload, S>

  type DepartmentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<DepartmentFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: DepartmentCountAggregateInputType | true
    }

  export interface DepartmentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Department'], meta: { name: 'Department' } }
    /**
     * Find zero or one Department that matches the filter.
     * @param {DepartmentFindUniqueArgs} args - Arguments to find a Department
     * @example
     * // Get one Department
     * const department = await prisma.department.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DepartmentFindUniqueArgs>(args: SelectSubset<T, DepartmentFindUniqueArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Department that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DepartmentFindUniqueOrThrowArgs} args - Arguments to find a Department
     * @example
     * // Get one Department
     * const department = await prisma.department.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DepartmentFindUniqueOrThrowArgs>(args: SelectSubset<T, DepartmentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Department that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentFindFirstArgs} args - Arguments to find a Department
     * @example
     * // Get one Department
     * const department = await prisma.department.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DepartmentFindFirstArgs>(args?: SelectSubset<T, DepartmentFindFirstArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Department that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentFindFirstOrThrowArgs} args - Arguments to find a Department
     * @example
     * // Get one Department
     * const department = await prisma.department.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DepartmentFindFirstOrThrowArgs>(args?: SelectSubset<T, DepartmentFindFirstOrThrowArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Departments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Departments
     * const departments = await prisma.department.findMany()
     * 
     * // Get first 10 Departments
     * const departments = await prisma.department.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const departmentWithIdOnly = await prisma.department.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DepartmentFindManyArgs>(args?: SelectSubset<T, DepartmentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Department.
     * @param {DepartmentCreateArgs} args - Arguments to create a Department.
     * @example
     * // Create one Department
     * const Department = await prisma.department.create({
     *   data: {
     *     // ... data to create a Department
     *   }
     * })
     * 
     */
    create<T extends DepartmentCreateArgs>(args: SelectSubset<T, DepartmentCreateArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Departments.
     * @param {DepartmentCreateManyArgs} args - Arguments to create many Departments.
     * @example
     * // Create many Departments
     * const department = await prisma.department.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DepartmentCreateManyArgs>(args?: SelectSubset<T, DepartmentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Departments and returns the data saved in the database.
     * @param {DepartmentCreateManyAndReturnArgs} args - Arguments to create many Departments.
     * @example
     * // Create many Departments
     * const department = await prisma.department.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Departments and only return the `id`
     * const departmentWithIdOnly = await prisma.department.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DepartmentCreateManyAndReturnArgs>(args?: SelectSubset<T, DepartmentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Department.
     * @param {DepartmentDeleteArgs} args - Arguments to delete one Department.
     * @example
     * // Delete one Department
     * const Department = await prisma.department.delete({
     *   where: {
     *     // ... filter to delete one Department
     *   }
     * })
     * 
     */
    delete<T extends DepartmentDeleteArgs>(args: SelectSubset<T, DepartmentDeleteArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Department.
     * @param {DepartmentUpdateArgs} args - Arguments to update one Department.
     * @example
     * // Update one Department
     * const department = await prisma.department.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DepartmentUpdateArgs>(args: SelectSubset<T, DepartmentUpdateArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Departments.
     * @param {DepartmentDeleteManyArgs} args - Arguments to filter Departments to delete.
     * @example
     * // Delete a few Departments
     * const { count } = await prisma.department.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DepartmentDeleteManyArgs>(args?: SelectSubset<T, DepartmentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Departments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Departments
     * const department = await prisma.department.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DepartmentUpdateManyArgs>(args: SelectSubset<T, DepartmentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Departments and returns the data updated in the database.
     * @param {DepartmentUpdateManyAndReturnArgs} args - Arguments to update many Departments.
     * @example
     * // Update many Departments
     * const department = await prisma.department.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Departments and only return the `id`
     * const departmentWithIdOnly = await prisma.department.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends DepartmentUpdateManyAndReturnArgs>(args: SelectSubset<T, DepartmentUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Department.
     * @param {DepartmentUpsertArgs} args - Arguments to update or create a Department.
     * @example
     * // Update or create a Department
     * const department = await prisma.department.upsert({
     *   create: {
     *     // ... data to create a Department
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Department we want to update
     *   }
     * })
     */
    upsert<T extends DepartmentUpsertArgs>(args: SelectSubset<T, DepartmentUpsertArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Departments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentCountArgs} args - Arguments to filter Departments to count.
     * @example
     * // Count the number of Departments
     * const count = await prisma.department.count({
     *   where: {
     *     // ... the filter for the Departments we want to count
     *   }
     * })
    **/
    count<T extends DepartmentCountArgs>(
      args?: Subset<T, DepartmentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DepartmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Department.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DepartmentAggregateArgs>(args: Subset<T, DepartmentAggregateArgs>): Prisma.PrismaPromise<GetDepartmentAggregateType<T>>

    /**
     * Group by Department.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DepartmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DepartmentGroupByArgs['orderBy'] }
        : { orderBy?: DepartmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DepartmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDepartmentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Department model
   */
  readonly fields: DepartmentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Department.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DepartmentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    businessUnit<T extends Department$businessUnitArgs<ExtArgs> = {}>(args?: Subset<T, Department$businessUnitArgs<ExtArgs>>): Prisma__BusinessUnitClient<$Result.GetResult<Prisma.$BusinessUnitPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    teams<T extends Department$teamsArgs<ExtArgs> = {}>(args?: Subset<T, Department$teamsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    employees<T extends Department$employeesArgs<ExtArgs> = {}>(args?: Subset<T, Department$employeesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Department model
   */
  interface DepartmentFieldRefs {
    readonly id: FieldRef<"Department", 'String'>
    readonly name: FieldRef<"Department", 'String'>
    readonly code: FieldRef<"Department", 'String'>
    readonly description: FieldRef<"Department", 'String'>
    readonly headId: FieldRef<"Department", 'String'>
    readonly businessUnitId: FieldRef<"Department", 'String'>
    readonly isActive: FieldRef<"Department", 'Boolean'>
    readonly createdAt: FieldRef<"Department", 'DateTime'>
    readonly updatedAt: FieldRef<"Department", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Department findUnique
   */
  export type DepartmentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Department to fetch.
     */
    where: DepartmentWhereUniqueInput
  }

  /**
   * Department findUniqueOrThrow
   */
  export type DepartmentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Department to fetch.
     */
    where: DepartmentWhereUniqueInput
  }

  /**
   * Department findFirst
   */
  export type DepartmentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Department to fetch.
     */
    where?: DepartmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Departments to fetch.
     */
    orderBy?: DepartmentOrderByWithRelationInput | DepartmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Departments.
     */
    cursor?: DepartmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Departments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Departments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Departments.
     */
    distinct?: DepartmentScalarFieldEnum | DepartmentScalarFieldEnum[]
  }

  /**
   * Department findFirstOrThrow
   */
  export type DepartmentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Department to fetch.
     */
    where?: DepartmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Departments to fetch.
     */
    orderBy?: DepartmentOrderByWithRelationInput | DepartmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Departments.
     */
    cursor?: DepartmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Departments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Departments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Departments.
     */
    distinct?: DepartmentScalarFieldEnum | DepartmentScalarFieldEnum[]
  }

  /**
   * Department findMany
   */
  export type DepartmentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Departments to fetch.
     */
    where?: DepartmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Departments to fetch.
     */
    orderBy?: DepartmentOrderByWithRelationInput | DepartmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Departments.
     */
    cursor?: DepartmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Departments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Departments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Departments.
     */
    distinct?: DepartmentScalarFieldEnum | DepartmentScalarFieldEnum[]
  }

  /**
   * Department create
   */
  export type DepartmentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * The data needed to create a Department.
     */
    data: XOR<DepartmentCreateInput, DepartmentUncheckedCreateInput>
  }

  /**
   * Department createMany
   */
  export type DepartmentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Departments.
     */
    data: DepartmentCreateManyInput | DepartmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Department createManyAndReturn
   */
  export type DepartmentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * The data used to create many Departments.
     */
    data: DepartmentCreateManyInput | DepartmentCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Department update
   */
  export type DepartmentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * The data needed to update a Department.
     */
    data: XOR<DepartmentUpdateInput, DepartmentUncheckedUpdateInput>
    /**
     * Choose, which Department to update.
     */
    where: DepartmentWhereUniqueInput
  }

  /**
   * Department updateMany
   */
  export type DepartmentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Departments.
     */
    data: XOR<DepartmentUpdateManyMutationInput, DepartmentUncheckedUpdateManyInput>
    /**
     * Filter which Departments to update
     */
    where?: DepartmentWhereInput
    /**
     * Limit how many Departments to update.
     */
    limit?: number
  }

  /**
   * Department updateManyAndReturn
   */
  export type DepartmentUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * The data used to update Departments.
     */
    data: XOR<DepartmentUpdateManyMutationInput, DepartmentUncheckedUpdateManyInput>
    /**
     * Filter which Departments to update
     */
    where?: DepartmentWhereInput
    /**
     * Limit how many Departments to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Department upsert
   */
  export type DepartmentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * The filter to search for the Department to update in case it exists.
     */
    where: DepartmentWhereUniqueInput
    /**
     * In case the Department found by the `where` argument doesn't exist, create a new Department with this data.
     */
    create: XOR<DepartmentCreateInput, DepartmentUncheckedCreateInput>
    /**
     * In case the Department was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DepartmentUpdateInput, DepartmentUncheckedUpdateInput>
  }

  /**
   * Department delete
   */
  export type DepartmentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter which Department to delete.
     */
    where: DepartmentWhereUniqueInput
  }

  /**
   * Department deleteMany
   */
  export type DepartmentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Departments to delete
     */
    where?: DepartmentWhereInput
    /**
     * Limit how many Departments to delete.
     */
    limit?: number
  }

  /**
   * Department.businessUnit
   */
  export type Department$businessUnitArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BusinessUnit
     */
    select?: BusinessUnitSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BusinessUnit
     */
    omit?: BusinessUnitOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BusinessUnitInclude<ExtArgs> | null
    where?: BusinessUnitWhereInput
  }

  /**
   * Department.teams
   */
  export type Department$teamsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    where?: TeamWhereInput
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    cursor?: TeamWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TeamScalarFieldEnum | TeamScalarFieldEnum[]
  }

  /**
   * Department.employees
   */
  export type Department$employeesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    where?: EmployeeWhereInput
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    cursor?: EmployeeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Department without action
   */
  export type DepartmentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
  }


  /**
   * Model Team
   */

  export type AggregateTeam = {
    _count: TeamCountAggregateOutputType | null
    _min: TeamMinAggregateOutputType | null
    _max: TeamMaxAggregateOutputType | null
  }

  export type TeamMinAggregateOutputType = {
    id: string | null
    name: string | null
    code: string | null
    description: string | null
    departmentId: string | null
    leadId: string | null
    projectFocus: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TeamMaxAggregateOutputType = {
    id: string | null
    name: string | null
    code: string | null
    description: string | null
    departmentId: string | null
    leadId: string | null
    projectFocus: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TeamCountAggregateOutputType = {
    id: number
    name: number
    code: number
    description: number
    departmentId: number
    leadId: number
    projectFocus: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TeamMinAggregateInputType = {
    id?: true
    name?: true
    code?: true
    description?: true
    departmentId?: true
    leadId?: true
    projectFocus?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TeamMaxAggregateInputType = {
    id?: true
    name?: true
    code?: true
    description?: true
    departmentId?: true
    leadId?: true
    projectFocus?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TeamCountAggregateInputType = {
    id?: true
    name?: true
    code?: true
    description?: true
    departmentId?: true
    leadId?: true
    projectFocus?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TeamAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Team to aggregate.
     */
    where?: TeamWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Teams to fetch.
     */
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TeamWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Teams from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Teams.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Teams
    **/
    _count?: true | TeamCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TeamMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TeamMaxAggregateInputType
  }

  export type GetTeamAggregateType<T extends TeamAggregateArgs> = {
        [P in keyof T & keyof AggregateTeam]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTeam[P]>
      : GetScalarType<T[P], AggregateTeam[P]>
  }




  export type TeamGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TeamWhereInput
    orderBy?: TeamOrderByWithAggregationInput | TeamOrderByWithAggregationInput[]
    by: TeamScalarFieldEnum[] | TeamScalarFieldEnum
    having?: TeamScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TeamCountAggregateInputType | true
    _min?: TeamMinAggregateInputType
    _max?: TeamMaxAggregateInputType
  }

  export type TeamGroupByOutputType = {
    id: string
    name: string
    code: string | null
    description: string | null
    departmentId: string
    leadId: string | null
    projectFocus: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: TeamCountAggregateOutputType | null
    _min: TeamMinAggregateOutputType | null
    _max: TeamMaxAggregateOutputType | null
  }

  type GetTeamGroupByPayload<T extends TeamGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TeamGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TeamGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TeamGroupByOutputType[P]>
            : GetScalarType<T[P], TeamGroupByOutputType[P]>
        }
      >
    >


  export type TeamSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    code?: boolean
    description?: boolean
    departmentId?: boolean
    leadId?: boolean
    projectFocus?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    department?: boolean | DepartmentDefaultArgs<ExtArgs>
    employees?: boolean | Team$employeesArgs<ExtArgs>
    _count?: boolean | TeamCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["team"]>

  export type TeamSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    code?: boolean
    description?: boolean
    departmentId?: boolean
    leadId?: boolean
    projectFocus?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    department?: boolean | DepartmentDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["team"]>

  export type TeamSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    code?: boolean
    description?: boolean
    departmentId?: boolean
    leadId?: boolean
    projectFocus?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    department?: boolean | DepartmentDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["team"]>

  export type TeamSelectScalar = {
    id?: boolean
    name?: boolean
    code?: boolean
    description?: boolean
    departmentId?: boolean
    leadId?: boolean
    projectFocus?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TeamOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "code" | "description" | "departmentId" | "leadId" | "projectFocus" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["team"]>
  export type TeamInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    department?: boolean | DepartmentDefaultArgs<ExtArgs>
    employees?: boolean | Team$employeesArgs<ExtArgs>
    _count?: boolean | TeamCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type TeamIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    department?: boolean | DepartmentDefaultArgs<ExtArgs>
  }
  export type TeamIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    department?: boolean | DepartmentDefaultArgs<ExtArgs>
  }

  export type $TeamPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Team"
    objects: {
      department: Prisma.$DepartmentPayload<ExtArgs>
      employees: Prisma.$EmployeePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      code: string | null
      description: string | null
      departmentId: string
      leadId: string | null
      projectFocus: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["team"]>
    composites: {}
  }

  type TeamGetPayload<S extends boolean | null | undefined | TeamDefaultArgs> = $Result.GetResult<Prisma.$TeamPayload, S>

  type TeamCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TeamFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TeamCountAggregateInputType | true
    }

  export interface TeamDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Team'], meta: { name: 'Team' } }
    /**
     * Find zero or one Team that matches the filter.
     * @param {TeamFindUniqueArgs} args - Arguments to find a Team
     * @example
     * // Get one Team
     * const team = await prisma.team.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TeamFindUniqueArgs>(args: SelectSubset<T, TeamFindUniqueArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Team that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TeamFindUniqueOrThrowArgs} args - Arguments to find a Team
     * @example
     * // Get one Team
     * const team = await prisma.team.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TeamFindUniqueOrThrowArgs>(args: SelectSubset<T, TeamFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Team that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamFindFirstArgs} args - Arguments to find a Team
     * @example
     * // Get one Team
     * const team = await prisma.team.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TeamFindFirstArgs>(args?: SelectSubset<T, TeamFindFirstArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Team that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamFindFirstOrThrowArgs} args - Arguments to find a Team
     * @example
     * // Get one Team
     * const team = await prisma.team.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TeamFindFirstOrThrowArgs>(args?: SelectSubset<T, TeamFindFirstOrThrowArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Teams that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Teams
     * const teams = await prisma.team.findMany()
     * 
     * // Get first 10 Teams
     * const teams = await prisma.team.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const teamWithIdOnly = await prisma.team.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TeamFindManyArgs>(args?: SelectSubset<T, TeamFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Team.
     * @param {TeamCreateArgs} args - Arguments to create a Team.
     * @example
     * // Create one Team
     * const Team = await prisma.team.create({
     *   data: {
     *     // ... data to create a Team
     *   }
     * })
     * 
     */
    create<T extends TeamCreateArgs>(args: SelectSubset<T, TeamCreateArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Teams.
     * @param {TeamCreateManyArgs} args - Arguments to create many Teams.
     * @example
     * // Create many Teams
     * const team = await prisma.team.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TeamCreateManyArgs>(args?: SelectSubset<T, TeamCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Teams and returns the data saved in the database.
     * @param {TeamCreateManyAndReturnArgs} args - Arguments to create many Teams.
     * @example
     * // Create many Teams
     * const team = await prisma.team.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Teams and only return the `id`
     * const teamWithIdOnly = await prisma.team.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TeamCreateManyAndReturnArgs>(args?: SelectSubset<T, TeamCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Team.
     * @param {TeamDeleteArgs} args - Arguments to delete one Team.
     * @example
     * // Delete one Team
     * const Team = await prisma.team.delete({
     *   where: {
     *     // ... filter to delete one Team
     *   }
     * })
     * 
     */
    delete<T extends TeamDeleteArgs>(args: SelectSubset<T, TeamDeleteArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Team.
     * @param {TeamUpdateArgs} args - Arguments to update one Team.
     * @example
     * // Update one Team
     * const team = await prisma.team.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TeamUpdateArgs>(args: SelectSubset<T, TeamUpdateArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Teams.
     * @param {TeamDeleteManyArgs} args - Arguments to filter Teams to delete.
     * @example
     * // Delete a few Teams
     * const { count } = await prisma.team.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TeamDeleteManyArgs>(args?: SelectSubset<T, TeamDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Teams.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Teams
     * const team = await prisma.team.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TeamUpdateManyArgs>(args: SelectSubset<T, TeamUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Teams and returns the data updated in the database.
     * @param {TeamUpdateManyAndReturnArgs} args - Arguments to update many Teams.
     * @example
     * // Update many Teams
     * const team = await prisma.team.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Teams and only return the `id`
     * const teamWithIdOnly = await prisma.team.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TeamUpdateManyAndReturnArgs>(args: SelectSubset<T, TeamUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Team.
     * @param {TeamUpsertArgs} args - Arguments to update or create a Team.
     * @example
     * // Update or create a Team
     * const team = await prisma.team.upsert({
     *   create: {
     *     // ... data to create a Team
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Team we want to update
     *   }
     * })
     */
    upsert<T extends TeamUpsertArgs>(args: SelectSubset<T, TeamUpsertArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Teams.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamCountArgs} args - Arguments to filter Teams to count.
     * @example
     * // Count the number of Teams
     * const count = await prisma.team.count({
     *   where: {
     *     // ... the filter for the Teams we want to count
     *   }
     * })
    **/
    count<T extends TeamCountArgs>(
      args?: Subset<T, TeamCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TeamCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Team.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TeamAggregateArgs>(args: Subset<T, TeamAggregateArgs>): Prisma.PrismaPromise<GetTeamAggregateType<T>>

    /**
     * Group by Team.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TeamGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TeamGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TeamGroupByArgs['orderBy'] }
        : { orderBy?: TeamGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TeamGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTeamGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Team model
   */
  readonly fields: TeamFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Team.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TeamClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    department<T extends DepartmentDefaultArgs<ExtArgs> = {}>(args?: Subset<T, DepartmentDefaultArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    employees<T extends Team$employeesArgs<ExtArgs> = {}>(args?: Subset<T, Team$employeesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Team model
   */
  interface TeamFieldRefs {
    readonly id: FieldRef<"Team", 'String'>
    readonly name: FieldRef<"Team", 'String'>
    readonly code: FieldRef<"Team", 'String'>
    readonly description: FieldRef<"Team", 'String'>
    readonly departmentId: FieldRef<"Team", 'String'>
    readonly leadId: FieldRef<"Team", 'String'>
    readonly projectFocus: FieldRef<"Team", 'String'>
    readonly isActive: FieldRef<"Team", 'Boolean'>
    readonly createdAt: FieldRef<"Team", 'DateTime'>
    readonly updatedAt: FieldRef<"Team", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Team findUnique
   */
  export type TeamFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Team to fetch.
     */
    where: TeamWhereUniqueInput
  }

  /**
   * Team findUniqueOrThrow
   */
  export type TeamFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Team to fetch.
     */
    where: TeamWhereUniqueInput
  }

  /**
   * Team findFirst
   */
  export type TeamFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Team to fetch.
     */
    where?: TeamWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Teams to fetch.
     */
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Teams.
     */
    cursor?: TeamWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Teams from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Teams.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Teams.
     */
    distinct?: TeamScalarFieldEnum | TeamScalarFieldEnum[]
  }

  /**
   * Team findFirstOrThrow
   */
  export type TeamFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Team to fetch.
     */
    where?: TeamWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Teams to fetch.
     */
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Teams.
     */
    cursor?: TeamWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Teams from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Teams.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Teams.
     */
    distinct?: TeamScalarFieldEnum | TeamScalarFieldEnum[]
  }

  /**
   * Team findMany
   */
  export type TeamFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter, which Teams to fetch.
     */
    where?: TeamWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Teams to fetch.
     */
    orderBy?: TeamOrderByWithRelationInput | TeamOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Teams.
     */
    cursor?: TeamWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Teams from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Teams.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Teams.
     */
    distinct?: TeamScalarFieldEnum | TeamScalarFieldEnum[]
  }

  /**
   * Team create
   */
  export type TeamCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * The data needed to create a Team.
     */
    data: XOR<TeamCreateInput, TeamUncheckedCreateInput>
  }

  /**
   * Team createMany
   */
  export type TeamCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Teams.
     */
    data: TeamCreateManyInput | TeamCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Team createManyAndReturn
   */
  export type TeamCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * The data used to create many Teams.
     */
    data: TeamCreateManyInput | TeamCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Team update
   */
  export type TeamUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * The data needed to update a Team.
     */
    data: XOR<TeamUpdateInput, TeamUncheckedUpdateInput>
    /**
     * Choose, which Team to update.
     */
    where: TeamWhereUniqueInput
  }

  /**
   * Team updateMany
   */
  export type TeamUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Teams.
     */
    data: XOR<TeamUpdateManyMutationInput, TeamUncheckedUpdateManyInput>
    /**
     * Filter which Teams to update
     */
    where?: TeamWhereInput
    /**
     * Limit how many Teams to update.
     */
    limit?: number
  }

  /**
   * Team updateManyAndReturn
   */
  export type TeamUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * The data used to update Teams.
     */
    data: XOR<TeamUpdateManyMutationInput, TeamUncheckedUpdateManyInput>
    /**
     * Filter which Teams to update
     */
    where?: TeamWhereInput
    /**
     * Limit how many Teams to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Team upsert
   */
  export type TeamUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * The filter to search for the Team to update in case it exists.
     */
    where: TeamWhereUniqueInput
    /**
     * In case the Team found by the `where` argument doesn't exist, create a new Team with this data.
     */
    create: XOR<TeamCreateInput, TeamUncheckedCreateInput>
    /**
     * In case the Team was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TeamUpdateInput, TeamUncheckedUpdateInput>
  }

  /**
   * Team delete
   */
  export type TeamDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    /**
     * Filter which Team to delete.
     */
    where: TeamWhereUniqueInput
  }

  /**
   * Team deleteMany
   */
  export type TeamDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Teams to delete
     */
    where?: TeamWhereInput
    /**
     * Limit how many Teams to delete.
     */
    limit?: number
  }

  /**
   * Team.employees
   */
  export type Team$employeesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    where?: EmployeeWhereInput
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    cursor?: EmployeeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Team without action
   */
  export type TeamDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
  }


  /**
   * Model Position
   */

  export type AggregatePosition = {
    _count: PositionCountAggregateOutputType | null
    _min: PositionMinAggregateOutputType | null
    _max: PositionMaxAggregateOutputType | null
  }

  export type PositionMinAggregateOutputType = {
    id: string | null
    title: string | null
    level: $Enums.PositionLevel | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type PositionMaxAggregateOutputType = {
    id: string | null
    title: string | null
    level: $Enums.PositionLevel | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type PositionCountAggregateOutputType = {
    id: number
    title: number
    level: number
    isActive: number
    createdAt: number
    _all: number
  }


  export type PositionMinAggregateInputType = {
    id?: true
    title?: true
    level?: true
    isActive?: true
    createdAt?: true
  }

  export type PositionMaxAggregateInputType = {
    id?: true
    title?: true
    level?: true
    isActive?: true
    createdAt?: true
  }

  export type PositionCountAggregateInputType = {
    id?: true
    title?: true
    level?: true
    isActive?: true
    createdAt?: true
    _all?: true
  }

  export type PositionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Position to aggregate.
     */
    where?: PositionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Positions to fetch.
     */
    orderBy?: PositionOrderByWithRelationInput | PositionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PositionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Positions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Positions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Positions
    **/
    _count?: true | PositionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PositionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PositionMaxAggregateInputType
  }

  export type GetPositionAggregateType<T extends PositionAggregateArgs> = {
        [P in keyof T & keyof AggregatePosition]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePosition[P]>
      : GetScalarType<T[P], AggregatePosition[P]>
  }




  export type PositionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PositionWhereInput
    orderBy?: PositionOrderByWithAggregationInput | PositionOrderByWithAggregationInput[]
    by: PositionScalarFieldEnum[] | PositionScalarFieldEnum
    having?: PositionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PositionCountAggregateInputType | true
    _min?: PositionMinAggregateInputType
    _max?: PositionMaxAggregateInputType
  }

  export type PositionGroupByOutputType = {
    id: string
    title: string
    level: $Enums.PositionLevel | null
    isActive: boolean
    createdAt: Date
    _count: PositionCountAggregateOutputType | null
    _min: PositionMinAggregateOutputType | null
    _max: PositionMaxAggregateOutputType | null
  }

  type GetPositionGroupByPayload<T extends PositionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PositionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PositionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PositionGroupByOutputType[P]>
            : GetScalarType<T[P], PositionGroupByOutputType[P]>
        }
      >
    >


  export type PositionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    level?: boolean
    isActive?: boolean
    createdAt?: boolean
    employees?: boolean | Position$employeesArgs<ExtArgs>
    _count?: boolean | PositionCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["position"]>

  export type PositionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    level?: boolean
    isActive?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["position"]>

  export type PositionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    level?: boolean
    isActive?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["position"]>

  export type PositionSelectScalar = {
    id?: boolean
    title?: boolean
    level?: boolean
    isActive?: boolean
    createdAt?: boolean
  }

  export type PositionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "title" | "level" | "isActive" | "createdAt", ExtArgs["result"]["position"]>
  export type PositionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employees?: boolean | Position$employeesArgs<ExtArgs>
    _count?: boolean | PositionCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PositionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type PositionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $PositionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Position"
    objects: {
      employees: Prisma.$EmployeePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      title: string
      level: $Enums.PositionLevel | null
      isActive: boolean
      createdAt: Date
    }, ExtArgs["result"]["position"]>
    composites: {}
  }

  type PositionGetPayload<S extends boolean | null | undefined | PositionDefaultArgs> = $Result.GetResult<Prisma.$PositionPayload, S>

  type PositionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PositionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PositionCountAggregateInputType | true
    }

  export interface PositionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Position'], meta: { name: 'Position' } }
    /**
     * Find zero or one Position that matches the filter.
     * @param {PositionFindUniqueArgs} args - Arguments to find a Position
     * @example
     * // Get one Position
     * const position = await prisma.position.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PositionFindUniqueArgs>(args: SelectSubset<T, PositionFindUniqueArgs<ExtArgs>>): Prisma__PositionClient<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Position that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PositionFindUniqueOrThrowArgs} args - Arguments to find a Position
     * @example
     * // Get one Position
     * const position = await prisma.position.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PositionFindUniqueOrThrowArgs>(args: SelectSubset<T, PositionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PositionClient<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Position that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PositionFindFirstArgs} args - Arguments to find a Position
     * @example
     * // Get one Position
     * const position = await prisma.position.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PositionFindFirstArgs>(args?: SelectSubset<T, PositionFindFirstArgs<ExtArgs>>): Prisma__PositionClient<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Position that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PositionFindFirstOrThrowArgs} args - Arguments to find a Position
     * @example
     * // Get one Position
     * const position = await prisma.position.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PositionFindFirstOrThrowArgs>(args?: SelectSubset<T, PositionFindFirstOrThrowArgs<ExtArgs>>): Prisma__PositionClient<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Positions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PositionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Positions
     * const positions = await prisma.position.findMany()
     * 
     * // Get first 10 Positions
     * const positions = await prisma.position.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const positionWithIdOnly = await prisma.position.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PositionFindManyArgs>(args?: SelectSubset<T, PositionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Position.
     * @param {PositionCreateArgs} args - Arguments to create a Position.
     * @example
     * // Create one Position
     * const Position = await prisma.position.create({
     *   data: {
     *     // ... data to create a Position
     *   }
     * })
     * 
     */
    create<T extends PositionCreateArgs>(args: SelectSubset<T, PositionCreateArgs<ExtArgs>>): Prisma__PositionClient<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Positions.
     * @param {PositionCreateManyArgs} args - Arguments to create many Positions.
     * @example
     * // Create many Positions
     * const position = await prisma.position.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PositionCreateManyArgs>(args?: SelectSubset<T, PositionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Positions and returns the data saved in the database.
     * @param {PositionCreateManyAndReturnArgs} args - Arguments to create many Positions.
     * @example
     * // Create many Positions
     * const position = await prisma.position.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Positions and only return the `id`
     * const positionWithIdOnly = await prisma.position.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PositionCreateManyAndReturnArgs>(args?: SelectSubset<T, PositionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Position.
     * @param {PositionDeleteArgs} args - Arguments to delete one Position.
     * @example
     * // Delete one Position
     * const Position = await prisma.position.delete({
     *   where: {
     *     // ... filter to delete one Position
     *   }
     * })
     * 
     */
    delete<T extends PositionDeleteArgs>(args: SelectSubset<T, PositionDeleteArgs<ExtArgs>>): Prisma__PositionClient<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Position.
     * @param {PositionUpdateArgs} args - Arguments to update one Position.
     * @example
     * // Update one Position
     * const position = await prisma.position.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PositionUpdateArgs>(args: SelectSubset<T, PositionUpdateArgs<ExtArgs>>): Prisma__PositionClient<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Positions.
     * @param {PositionDeleteManyArgs} args - Arguments to filter Positions to delete.
     * @example
     * // Delete a few Positions
     * const { count } = await prisma.position.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PositionDeleteManyArgs>(args?: SelectSubset<T, PositionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Positions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PositionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Positions
     * const position = await prisma.position.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PositionUpdateManyArgs>(args: SelectSubset<T, PositionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Positions and returns the data updated in the database.
     * @param {PositionUpdateManyAndReturnArgs} args - Arguments to update many Positions.
     * @example
     * // Update many Positions
     * const position = await prisma.position.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Positions and only return the `id`
     * const positionWithIdOnly = await prisma.position.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PositionUpdateManyAndReturnArgs>(args: SelectSubset<T, PositionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Position.
     * @param {PositionUpsertArgs} args - Arguments to update or create a Position.
     * @example
     * // Update or create a Position
     * const position = await prisma.position.upsert({
     *   create: {
     *     // ... data to create a Position
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Position we want to update
     *   }
     * })
     */
    upsert<T extends PositionUpsertArgs>(args: SelectSubset<T, PositionUpsertArgs<ExtArgs>>): Prisma__PositionClient<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Positions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PositionCountArgs} args - Arguments to filter Positions to count.
     * @example
     * // Count the number of Positions
     * const count = await prisma.position.count({
     *   where: {
     *     // ... the filter for the Positions we want to count
     *   }
     * })
    **/
    count<T extends PositionCountArgs>(
      args?: Subset<T, PositionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PositionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Position.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PositionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PositionAggregateArgs>(args: Subset<T, PositionAggregateArgs>): Prisma.PrismaPromise<GetPositionAggregateType<T>>

    /**
     * Group by Position.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PositionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PositionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PositionGroupByArgs['orderBy'] }
        : { orderBy?: PositionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PositionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPositionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Position model
   */
  readonly fields: PositionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Position.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PositionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    employees<T extends Position$employeesArgs<ExtArgs> = {}>(args?: Subset<T, Position$employeesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Position model
   */
  interface PositionFieldRefs {
    readonly id: FieldRef<"Position", 'String'>
    readonly title: FieldRef<"Position", 'String'>
    readonly level: FieldRef<"Position", 'PositionLevel'>
    readonly isActive: FieldRef<"Position", 'Boolean'>
    readonly createdAt: FieldRef<"Position", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Position findUnique
   */
  export type PositionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    /**
     * Filter, which Position to fetch.
     */
    where: PositionWhereUniqueInput
  }

  /**
   * Position findUniqueOrThrow
   */
  export type PositionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    /**
     * Filter, which Position to fetch.
     */
    where: PositionWhereUniqueInput
  }

  /**
   * Position findFirst
   */
  export type PositionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    /**
     * Filter, which Position to fetch.
     */
    where?: PositionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Positions to fetch.
     */
    orderBy?: PositionOrderByWithRelationInput | PositionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Positions.
     */
    cursor?: PositionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Positions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Positions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Positions.
     */
    distinct?: PositionScalarFieldEnum | PositionScalarFieldEnum[]
  }

  /**
   * Position findFirstOrThrow
   */
  export type PositionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    /**
     * Filter, which Position to fetch.
     */
    where?: PositionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Positions to fetch.
     */
    orderBy?: PositionOrderByWithRelationInput | PositionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Positions.
     */
    cursor?: PositionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Positions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Positions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Positions.
     */
    distinct?: PositionScalarFieldEnum | PositionScalarFieldEnum[]
  }

  /**
   * Position findMany
   */
  export type PositionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    /**
     * Filter, which Positions to fetch.
     */
    where?: PositionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Positions to fetch.
     */
    orderBy?: PositionOrderByWithRelationInput | PositionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Positions.
     */
    cursor?: PositionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Positions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Positions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Positions.
     */
    distinct?: PositionScalarFieldEnum | PositionScalarFieldEnum[]
  }

  /**
   * Position create
   */
  export type PositionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    /**
     * The data needed to create a Position.
     */
    data: XOR<PositionCreateInput, PositionUncheckedCreateInput>
  }

  /**
   * Position createMany
   */
  export type PositionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Positions.
     */
    data: PositionCreateManyInput | PositionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Position createManyAndReturn
   */
  export type PositionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * The data used to create many Positions.
     */
    data: PositionCreateManyInput | PositionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Position update
   */
  export type PositionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    /**
     * The data needed to update a Position.
     */
    data: XOR<PositionUpdateInput, PositionUncheckedUpdateInput>
    /**
     * Choose, which Position to update.
     */
    where: PositionWhereUniqueInput
  }

  /**
   * Position updateMany
   */
  export type PositionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Positions.
     */
    data: XOR<PositionUpdateManyMutationInput, PositionUncheckedUpdateManyInput>
    /**
     * Filter which Positions to update
     */
    where?: PositionWhereInput
    /**
     * Limit how many Positions to update.
     */
    limit?: number
  }

  /**
   * Position updateManyAndReturn
   */
  export type PositionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * The data used to update Positions.
     */
    data: XOR<PositionUpdateManyMutationInput, PositionUncheckedUpdateManyInput>
    /**
     * Filter which Positions to update
     */
    where?: PositionWhereInput
    /**
     * Limit how many Positions to update.
     */
    limit?: number
  }

  /**
   * Position upsert
   */
  export type PositionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    /**
     * The filter to search for the Position to update in case it exists.
     */
    where: PositionWhereUniqueInput
    /**
     * In case the Position found by the `where` argument doesn't exist, create a new Position with this data.
     */
    create: XOR<PositionCreateInput, PositionUncheckedCreateInput>
    /**
     * In case the Position was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PositionUpdateInput, PositionUncheckedUpdateInput>
  }

  /**
   * Position delete
   */
  export type PositionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    /**
     * Filter which Position to delete.
     */
    where: PositionWhereUniqueInput
  }

  /**
   * Position deleteMany
   */
  export type PositionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Positions to delete
     */
    where?: PositionWhereInput
    /**
     * Limit how many Positions to delete.
     */
    limit?: number
  }

  /**
   * Position.employees
   */
  export type Position$employeesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    where?: EmployeeWhereInput
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    cursor?: EmployeeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Position without action
   */
  export type PositionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
  }


  /**
   * Model Employee
   */

  export type AggregateEmployee = {
    _count: EmployeeCountAggregateOutputType | null
    _avg: EmployeeAvgAggregateOutputType | null
    _sum: EmployeeSumAggregateOutputType | null
    _min: EmployeeMinAggregateOutputType | null
    _max: EmployeeMaxAggregateOutputType | null
  }

  export type EmployeeAvgAggregateOutputType = {
    grossSalary: Decimal | null
    netSalary: Decimal | null
  }

  export type EmployeeSumAggregateOutputType = {
    grossSalary: Decimal | null
    netSalary: Decimal | null
  }

  export type EmployeeMinAggregateOutputType = {
    id: string | null
    employeeCode: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    dateOfBirth: Date | null
    hireDate: Date | null
    employmentStatus: $Enums.EmploymentStatus | null
    contractType: $Enums.ContractType | null
    grossSalary: Decimal | null
    netSalary: Decimal | null
    maritalStatus: $Enums.MaritalStatus | null
    educationLevel: $Enums.EducationLevel | null
    educationField: string | null
    positionId: string | null
    departmentId: string | null
    teamId: string | null
    managerId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type EmployeeMaxAggregateOutputType = {
    id: string | null
    employeeCode: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    dateOfBirth: Date | null
    hireDate: Date | null
    employmentStatus: $Enums.EmploymentStatus | null
    contractType: $Enums.ContractType | null
    grossSalary: Decimal | null
    netSalary: Decimal | null
    maritalStatus: $Enums.MaritalStatus | null
    educationLevel: $Enums.EducationLevel | null
    educationField: string | null
    positionId: string | null
    departmentId: string | null
    teamId: string | null
    managerId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type EmployeeCountAggregateOutputType = {
    id: number
    employeeCode: number
    firstName: number
    lastName: number
    email: number
    phone: number
    dateOfBirth: number
    hireDate: number
    employmentStatus: number
    contractType: number
    grossSalary: number
    netSalary: number
    maritalStatus: number
    educationLevel: number
    educationField: number
    positionId: number
    departmentId: number
    teamId: number
    managerId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type EmployeeAvgAggregateInputType = {
    grossSalary?: true
    netSalary?: true
  }

  export type EmployeeSumAggregateInputType = {
    grossSalary?: true
    netSalary?: true
  }

  export type EmployeeMinAggregateInputType = {
    id?: true
    employeeCode?: true
    firstName?: true
    lastName?: true
    email?: true
    phone?: true
    dateOfBirth?: true
    hireDate?: true
    employmentStatus?: true
    contractType?: true
    grossSalary?: true
    netSalary?: true
    maritalStatus?: true
    educationLevel?: true
    educationField?: true
    positionId?: true
    departmentId?: true
    teamId?: true
    managerId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type EmployeeMaxAggregateInputType = {
    id?: true
    employeeCode?: true
    firstName?: true
    lastName?: true
    email?: true
    phone?: true
    dateOfBirth?: true
    hireDate?: true
    employmentStatus?: true
    contractType?: true
    grossSalary?: true
    netSalary?: true
    maritalStatus?: true
    educationLevel?: true
    educationField?: true
    positionId?: true
    departmentId?: true
    teamId?: true
    managerId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type EmployeeCountAggregateInputType = {
    id?: true
    employeeCode?: true
    firstName?: true
    lastName?: true
    email?: true
    phone?: true
    dateOfBirth?: true
    hireDate?: true
    employmentStatus?: true
    contractType?: true
    grossSalary?: true
    netSalary?: true
    maritalStatus?: true
    educationLevel?: true
    educationField?: true
    positionId?: true
    departmentId?: true
    teamId?: true
    managerId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type EmployeeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Employee to aggregate.
     */
    where?: EmployeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Employees to fetch.
     */
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EmployeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Employees
    **/
    _count?: true | EmployeeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: EmployeeAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: EmployeeSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EmployeeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EmployeeMaxAggregateInputType
  }

  export type GetEmployeeAggregateType<T extends EmployeeAggregateArgs> = {
        [P in keyof T & keyof AggregateEmployee]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEmployee[P]>
      : GetScalarType<T[P], AggregateEmployee[P]>
  }




  export type EmployeeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EmployeeWhereInput
    orderBy?: EmployeeOrderByWithAggregationInput | EmployeeOrderByWithAggregationInput[]
    by: EmployeeScalarFieldEnum[] | EmployeeScalarFieldEnum
    having?: EmployeeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EmployeeCountAggregateInputType | true
    _avg?: EmployeeAvgAggregateInputType
    _sum?: EmployeeSumAggregateInputType
    _min?: EmployeeMinAggregateInputType
    _max?: EmployeeMaxAggregateInputType
  }

  export type EmployeeGroupByOutputType = {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    dateOfBirth: Date | null
    hireDate: Date
    employmentStatus: $Enums.EmploymentStatus
    contractType: $Enums.ContractType
    grossSalary: Decimal | null
    netSalary: Decimal | null
    maritalStatus: $Enums.MaritalStatus | null
    educationLevel: $Enums.EducationLevel | null
    educationField: string | null
    positionId: string | null
    departmentId: string | null
    teamId: string | null
    managerId: string | null
    createdAt: Date
    updatedAt: Date
    _count: EmployeeCountAggregateOutputType | null
    _avg: EmployeeAvgAggregateOutputType | null
    _sum: EmployeeSumAggregateOutputType | null
    _min: EmployeeMinAggregateOutputType | null
    _max: EmployeeMaxAggregateOutputType | null
  }

  type GetEmployeeGroupByPayload<T extends EmployeeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EmployeeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EmployeeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EmployeeGroupByOutputType[P]>
            : GetScalarType<T[P], EmployeeGroupByOutputType[P]>
        }
      >
    >


  export type EmployeeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    employeeCode?: boolean
    firstName?: boolean
    lastName?: boolean
    email?: boolean
    phone?: boolean
    dateOfBirth?: boolean
    hireDate?: boolean
    employmentStatus?: boolean
    contractType?: boolean
    grossSalary?: boolean
    netSalary?: boolean
    maritalStatus?: boolean
    educationLevel?: boolean
    educationField?: boolean
    positionId?: boolean
    departmentId?: boolean
    teamId?: boolean
    managerId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    position?: boolean | Employee$positionArgs<ExtArgs>
    department?: boolean | Employee$departmentArgs<ExtArgs>
    team?: boolean | Employee$teamArgs<ExtArgs>
    manager?: boolean | Employee$managerArgs<ExtArgs>
    directReports?: boolean | Employee$directReportsArgs<ExtArgs>
    salaryHistory?: boolean | Employee$salaryHistoryArgs<ExtArgs>
    _count?: boolean | EmployeeCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["employee"]>

  export type EmployeeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    employeeCode?: boolean
    firstName?: boolean
    lastName?: boolean
    email?: boolean
    phone?: boolean
    dateOfBirth?: boolean
    hireDate?: boolean
    employmentStatus?: boolean
    contractType?: boolean
    grossSalary?: boolean
    netSalary?: boolean
    maritalStatus?: boolean
    educationLevel?: boolean
    educationField?: boolean
    positionId?: boolean
    departmentId?: boolean
    teamId?: boolean
    managerId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    position?: boolean | Employee$positionArgs<ExtArgs>
    department?: boolean | Employee$departmentArgs<ExtArgs>
    team?: boolean | Employee$teamArgs<ExtArgs>
    manager?: boolean | Employee$managerArgs<ExtArgs>
  }, ExtArgs["result"]["employee"]>

  export type EmployeeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    employeeCode?: boolean
    firstName?: boolean
    lastName?: boolean
    email?: boolean
    phone?: boolean
    dateOfBirth?: boolean
    hireDate?: boolean
    employmentStatus?: boolean
    contractType?: boolean
    grossSalary?: boolean
    netSalary?: boolean
    maritalStatus?: boolean
    educationLevel?: boolean
    educationField?: boolean
    positionId?: boolean
    departmentId?: boolean
    teamId?: boolean
    managerId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    position?: boolean | Employee$positionArgs<ExtArgs>
    department?: boolean | Employee$departmentArgs<ExtArgs>
    team?: boolean | Employee$teamArgs<ExtArgs>
    manager?: boolean | Employee$managerArgs<ExtArgs>
  }, ExtArgs["result"]["employee"]>

  export type EmployeeSelectScalar = {
    id?: boolean
    employeeCode?: boolean
    firstName?: boolean
    lastName?: boolean
    email?: boolean
    phone?: boolean
    dateOfBirth?: boolean
    hireDate?: boolean
    employmentStatus?: boolean
    contractType?: boolean
    grossSalary?: boolean
    netSalary?: boolean
    maritalStatus?: boolean
    educationLevel?: boolean
    educationField?: boolean
    positionId?: boolean
    departmentId?: boolean
    teamId?: boolean
    managerId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type EmployeeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "employeeCode" | "firstName" | "lastName" | "email" | "phone" | "dateOfBirth" | "hireDate" | "employmentStatus" | "contractType" | "grossSalary" | "netSalary" | "maritalStatus" | "educationLevel" | "educationField" | "positionId" | "departmentId" | "teamId" | "managerId" | "createdAt" | "updatedAt", ExtArgs["result"]["employee"]>
  export type EmployeeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    position?: boolean | Employee$positionArgs<ExtArgs>
    department?: boolean | Employee$departmentArgs<ExtArgs>
    team?: boolean | Employee$teamArgs<ExtArgs>
    manager?: boolean | Employee$managerArgs<ExtArgs>
    directReports?: boolean | Employee$directReportsArgs<ExtArgs>
    salaryHistory?: boolean | Employee$salaryHistoryArgs<ExtArgs>
    _count?: boolean | EmployeeCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type EmployeeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    position?: boolean | Employee$positionArgs<ExtArgs>
    department?: boolean | Employee$departmentArgs<ExtArgs>
    team?: boolean | Employee$teamArgs<ExtArgs>
    manager?: boolean | Employee$managerArgs<ExtArgs>
  }
  export type EmployeeIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    position?: boolean | Employee$positionArgs<ExtArgs>
    department?: boolean | Employee$departmentArgs<ExtArgs>
    team?: boolean | Employee$teamArgs<ExtArgs>
    manager?: boolean | Employee$managerArgs<ExtArgs>
  }

  export type $EmployeePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Employee"
    objects: {
      position: Prisma.$PositionPayload<ExtArgs> | null
      department: Prisma.$DepartmentPayload<ExtArgs> | null
      team: Prisma.$TeamPayload<ExtArgs> | null
      manager: Prisma.$EmployeePayload<ExtArgs> | null
      directReports: Prisma.$EmployeePayload<ExtArgs>[]
      salaryHistory: Prisma.$SalaryHistoryPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      employeeCode: string
      firstName: string
      lastName: string
      email: string
      phone: string | null
      dateOfBirth: Date | null
      hireDate: Date
      employmentStatus: $Enums.EmploymentStatus
      contractType: $Enums.ContractType
      grossSalary: Prisma.Decimal | null
      netSalary: Prisma.Decimal | null
      maritalStatus: $Enums.MaritalStatus | null
      educationLevel: $Enums.EducationLevel | null
      educationField: string | null
      positionId: string | null
      departmentId: string | null
      teamId: string | null
      managerId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["employee"]>
    composites: {}
  }

  type EmployeeGetPayload<S extends boolean | null | undefined | EmployeeDefaultArgs> = $Result.GetResult<Prisma.$EmployeePayload, S>

  type EmployeeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<EmployeeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: EmployeeCountAggregateInputType | true
    }

  export interface EmployeeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Employee'], meta: { name: 'Employee' } }
    /**
     * Find zero or one Employee that matches the filter.
     * @param {EmployeeFindUniqueArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EmployeeFindUniqueArgs>(args: SelectSubset<T, EmployeeFindUniqueArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Employee that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {EmployeeFindUniqueOrThrowArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EmployeeFindUniqueOrThrowArgs>(args: SelectSubset<T, EmployeeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Employee that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeFindFirstArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EmployeeFindFirstArgs>(args?: SelectSubset<T, EmployeeFindFirstArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Employee that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeFindFirstOrThrowArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EmployeeFindFirstOrThrowArgs>(args?: SelectSubset<T, EmployeeFindFirstOrThrowArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Employees that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Employees
     * const employees = await prisma.employee.findMany()
     * 
     * // Get first 10 Employees
     * const employees = await prisma.employee.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const employeeWithIdOnly = await prisma.employee.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends EmployeeFindManyArgs>(args?: SelectSubset<T, EmployeeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Employee.
     * @param {EmployeeCreateArgs} args - Arguments to create a Employee.
     * @example
     * // Create one Employee
     * const Employee = await prisma.employee.create({
     *   data: {
     *     // ... data to create a Employee
     *   }
     * })
     * 
     */
    create<T extends EmployeeCreateArgs>(args: SelectSubset<T, EmployeeCreateArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Employees.
     * @param {EmployeeCreateManyArgs} args - Arguments to create many Employees.
     * @example
     * // Create many Employees
     * const employee = await prisma.employee.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EmployeeCreateManyArgs>(args?: SelectSubset<T, EmployeeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Employees and returns the data saved in the database.
     * @param {EmployeeCreateManyAndReturnArgs} args - Arguments to create many Employees.
     * @example
     * // Create many Employees
     * const employee = await prisma.employee.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Employees and only return the `id`
     * const employeeWithIdOnly = await prisma.employee.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EmployeeCreateManyAndReturnArgs>(args?: SelectSubset<T, EmployeeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Employee.
     * @param {EmployeeDeleteArgs} args - Arguments to delete one Employee.
     * @example
     * // Delete one Employee
     * const Employee = await prisma.employee.delete({
     *   where: {
     *     // ... filter to delete one Employee
     *   }
     * })
     * 
     */
    delete<T extends EmployeeDeleteArgs>(args: SelectSubset<T, EmployeeDeleteArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Employee.
     * @param {EmployeeUpdateArgs} args - Arguments to update one Employee.
     * @example
     * // Update one Employee
     * const employee = await prisma.employee.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EmployeeUpdateArgs>(args: SelectSubset<T, EmployeeUpdateArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Employees.
     * @param {EmployeeDeleteManyArgs} args - Arguments to filter Employees to delete.
     * @example
     * // Delete a few Employees
     * const { count } = await prisma.employee.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EmployeeDeleteManyArgs>(args?: SelectSubset<T, EmployeeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Employees.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Employees
     * const employee = await prisma.employee.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EmployeeUpdateManyArgs>(args: SelectSubset<T, EmployeeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Employees and returns the data updated in the database.
     * @param {EmployeeUpdateManyAndReturnArgs} args - Arguments to update many Employees.
     * @example
     * // Update many Employees
     * const employee = await prisma.employee.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Employees and only return the `id`
     * const employeeWithIdOnly = await prisma.employee.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends EmployeeUpdateManyAndReturnArgs>(args: SelectSubset<T, EmployeeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Employee.
     * @param {EmployeeUpsertArgs} args - Arguments to update or create a Employee.
     * @example
     * // Update or create a Employee
     * const employee = await prisma.employee.upsert({
     *   create: {
     *     // ... data to create a Employee
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Employee we want to update
     *   }
     * })
     */
    upsert<T extends EmployeeUpsertArgs>(args: SelectSubset<T, EmployeeUpsertArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Employees.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeCountArgs} args - Arguments to filter Employees to count.
     * @example
     * // Count the number of Employees
     * const count = await prisma.employee.count({
     *   where: {
     *     // ... the filter for the Employees we want to count
     *   }
     * })
    **/
    count<T extends EmployeeCountArgs>(
      args?: Subset<T, EmployeeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EmployeeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Employee.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EmployeeAggregateArgs>(args: Subset<T, EmployeeAggregateArgs>): Prisma.PrismaPromise<GetEmployeeAggregateType<T>>

    /**
     * Group by Employee.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EmployeeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EmployeeGroupByArgs['orderBy'] }
        : { orderBy?: EmployeeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EmployeeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmployeeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Employee model
   */
  readonly fields: EmployeeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Employee.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EmployeeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    position<T extends Employee$positionArgs<ExtArgs> = {}>(args?: Subset<T, Employee$positionArgs<ExtArgs>>): Prisma__PositionClient<$Result.GetResult<Prisma.$PositionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    department<T extends Employee$departmentArgs<ExtArgs> = {}>(args?: Subset<T, Employee$departmentArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    team<T extends Employee$teamArgs<ExtArgs> = {}>(args?: Subset<T, Employee$teamArgs<ExtArgs>>): Prisma__TeamClient<$Result.GetResult<Prisma.$TeamPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    manager<T extends Employee$managerArgs<ExtArgs> = {}>(args?: Subset<T, Employee$managerArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    directReports<T extends Employee$directReportsArgs<ExtArgs> = {}>(args?: Subset<T, Employee$directReportsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    salaryHistory<T extends Employee$salaryHistoryArgs<ExtArgs> = {}>(args?: Subset<T, Employee$salaryHistoryArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Employee model
   */
  interface EmployeeFieldRefs {
    readonly id: FieldRef<"Employee", 'String'>
    readonly employeeCode: FieldRef<"Employee", 'String'>
    readonly firstName: FieldRef<"Employee", 'String'>
    readonly lastName: FieldRef<"Employee", 'String'>
    readonly email: FieldRef<"Employee", 'String'>
    readonly phone: FieldRef<"Employee", 'String'>
    readonly dateOfBirth: FieldRef<"Employee", 'DateTime'>
    readonly hireDate: FieldRef<"Employee", 'DateTime'>
    readonly employmentStatus: FieldRef<"Employee", 'EmploymentStatus'>
    readonly contractType: FieldRef<"Employee", 'ContractType'>
    readonly grossSalary: FieldRef<"Employee", 'Decimal'>
    readonly netSalary: FieldRef<"Employee", 'Decimal'>
    readonly maritalStatus: FieldRef<"Employee", 'MaritalStatus'>
    readonly educationLevel: FieldRef<"Employee", 'EducationLevel'>
    readonly educationField: FieldRef<"Employee", 'String'>
    readonly positionId: FieldRef<"Employee", 'String'>
    readonly departmentId: FieldRef<"Employee", 'String'>
    readonly teamId: FieldRef<"Employee", 'String'>
    readonly managerId: FieldRef<"Employee", 'String'>
    readonly createdAt: FieldRef<"Employee", 'DateTime'>
    readonly updatedAt: FieldRef<"Employee", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Employee findUnique
   */
  export type EmployeeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employee to fetch.
     */
    where: EmployeeWhereUniqueInput
  }

  /**
   * Employee findUniqueOrThrow
   */
  export type EmployeeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employee to fetch.
     */
    where: EmployeeWhereUniqueInput
  }

  /**
   * Employee findFirst
   */
  export type EmployeeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employee to fetch.
     */
    where?: EmployeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Employees to fetch.
     */
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Employees.
     */
    cursor?: EmployeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Employees.
     */
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Employee findFirstOrThrow
   */
  export type EmployeeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employee to fetch.
     */
    where?: EmployeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Employees to fetch.
     */
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Employees.
     */
    cursor?: EmployeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Employees.
     */
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Employee findMany
   */
  export type EmployeeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter, which Employees to fetch.
     */
    where?: EmployeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Employees to fetch.
     */
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Employees.
     */
    cursor?: EmployeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Employees.
     */
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Employee create
   */
  export type EmployeeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * The data needed to create a Employee.
     */
    data: XOR<EmployeeCreateInput, EmployeeUncheckedCreateInput>
  }

  /**
   * Employee createMany
   */
  export type EmployeeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Employees.
     */
    data: EmployeeCreateManyInput | EmployeeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Employee createManyAndReturn
   */
  export type EmployeeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * The data used to create many Employees.
     */
    data: EmployeeCreateManyInput | EmployeeCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Employee update
   */
  export type EmployeeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * The data needed to update a Employee.
     */
    data: XOR<EmployeeUpdateInput, EmployeeUncheckedUpdateInput>
    /**
     * Choose, which Employee to update.
     */
    where: EmployeeWhereUniqueInput
  }

  /**
   * Employee updateMany
   */
  export type EmployeeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Employees.
     */
    data: XOR<EmployeeUpdateManyMutationInput, EmployeeUncheckedUpdateManyInput>
    /**
     * Filter which Employees to update
     */
    where?: EmployeeWhereInput
    /**
     * Limit how many Employees to update.
     */
    limit?: number
  }

  /**
   * Employee updateManyAndReturn
   */
  export type EmployeeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * The data used to update Employees.
     */
    data: XOR<EmployeeUpdateManyMutationInput, EmployeeUncheckedUpdateManyInput>
    /**
     * Filter which Employees to update
     */
    where?: EmployeeWhereInput
    /**
     * Limit how many Employees to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Employee upsert
   */
  export type EmployeeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * The filter to search for the Employee to update in case it exists.
     */
    where: EmployeeWhereUniqueInput
    /**
     * In case the Employee found by the `where` argument doesn't exist, create a new Employee with this data.
     */
    create: XOR<EmployeeCreateInput, EmployeeUncheckedCreateInput>
    /**
     * In case the Employee was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EmployeeUpdateInput, EmployeeUncheckedUpdateInput>
  }

  /**
   * Employee delete
   */
  export type EmployeeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    /**
     * Filter which Employee to delete.
     */
    where: EmployeeWhereUniqueInput
  }

  /**
   * Employee deleteMany
   */
  export type EmployeeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Employees to delete
     */
    where?: EmployeeWhereInput
    /**
     * Limit how many Employees to delete.
     */
    limit?: number
  }

  /**
   * Employee.position
   */
  export type Employee$positionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Position
     */
    select?: PositionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Position
     */
    omit?: PositionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PositionInclude<ExtArgs> | null
    where?: PositionWhereInput
  }

  /**
   * Employee.department
   */
  export type Employee$departmentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    where?: DepartmentWhereInput
  }

  /**
   * Employee.team
   */
  export type Employee$teamArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Team
     */
    select?: TeamSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Team
     */
    omit?: TeamOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TeamInclude<ExtArgs> | null
    where?: TeamWhereInput
  }

  /**
   * Employee.manager
   */
  export type Employee$managerArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    where?: EmployeeWhereInput
  }

  /**
   * Employee.directReports
   */
  export type Employee$directReportsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
    where?: EmployeeWhereInput
    orderBy?: EmployeeOrderByWithRelationInput | EmployeeOrderByWithRelationInput[]
    cursor?: EmployeeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * Employee.salaryHistory
   */
  export type Employee$salaryHistoryArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    where?: SalaryHistoryWhereInput
    orderBy?: SalaryHistoryOrderByWithRelationInput | SalaryHistoryOrderByWithRelationInput[]
    cursor?: SalaryHistoryWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SalaryHistoryScalarFieldEnum | SalaryHistoryScalarFieldEnum[]
  }

  /**
   * Employee without action
   */
  export type EmployeeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Employee
     */
    select?: EmployeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Employee
     */
    omit?: EmployeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EmployeeInclude<ExtArgs> | null
  }


  /**
   * Model SalaryHistory
   */

  export type AggregateSalaryHistory = {
    _count: SalaryHistoryCountAggregateOutputType | null
    _avg: SalaryHistoryAvgAggregateOutputType | null
    _sum: SalaryHistorySumAggregateOutputType | null
    _min: SalaryHistoryMinAggregateOutputType | null
    _max: SalaryHistoryMaxAggregateOutputType | null
  }

  export type SalaryHistoryAvgAggregateOutputType = {
    previousGrossSalary: Decimal | null
    newGrossSalary: Decimal | null
    previousNetSalary: Decimal | null
    newNetSalary: Decimal | null
    grossRaisePercentage: Decimal | null
    netRaisePercentage: Decimal | null
  }

  export type SalaryHistorySumAggregateOutputType = {
    previousGrossSalary: Decimal | null
    newGrossSalary: Decimal | null
    previousNetSalary: Decimal | null
    newNetSalary: Decimal | null
    grossRaisePercentage: Decimal | null
    netRaisePercentage: Decimal | null
  }

  export type SalaryHistoryMinAggregateOutputType = {
    id: string | null
    employeeId: string | null
    previousGrossSalary: Decimal | null
    newGrossSalary: Decimal | null
    previousNetSalary: Decimal | null
    newNetSalary: Decimal | null
    grossRaisePercentage: Decimal | null
    netRaisePercentage: Decimal | null
    effectiveDate: Date | null
    reason: $Enums.SalaryChangeReason | null
    reasonComment: string | null
    changedById: string | null
    createdAt: Date | null
  }

  export type SalaryHistoryMaxAggregateOutputType = {
    id: string | null
    employeeId: string | null
    previousGrossSalary: Decimal | null
    newGrossSalary: Decimal | null
    previousNetSalary: Decimal | null
    newNetSalary: Decimal | null
    grossRaisePercentage: Decimal | null
    netRaisePercentage: Decimal | null
    effectiveDate: Date | null
    reason: $Enums.SalaryChangeReason | null
    reasonComment: string | null
    changedById: string | null
    createdAt: Date | null
  }

  export type SalaryHistoryCountAggregateOutputType = {
    id: number
    employeeId: number
    previousGrossSalary: number
    newGrossSalary: number
    previousNetSalary: number
    newNetSalary: number
    grossRaisePercentage: number
    netRaisePercentage: number
    effectiveDate: number
    reason: number
    reasonComment: number
    changedById: number
    createdAt: number
    _all: number
  }


  export type SalaryHistoryAvgAggregateInputType = {
    previousGrossSalary?: true
    newGrossSalary?: true
    previousNetSalary?: true
    newNetSalary?: true
    grossRaisePercentage?: true
    netRaisePercentage?: true
  }

  export type SalaryHistorySumAggregateInputType = {
    previousGrossSalary?: true
    newGrossSalary?: true
    previousNetSalary?: true
    newNetSalary?: true
    grossRaisePercentage?: true
    netRaisePercentage?: true
  }

  export type SalaryHistoryMinAggregateInputType = {
    id?: true
    employeeId?: true
    previousGrossSalary?: true
    newGrossSalary?: true
    previousNetSalary?: true
    newNetSalary?: true
    grossRaisePercentage?: true
    netRaisePercentage?: true
    effectiveDate?: true
    reason?: true
    reasonComment?: true
    changedById?: true
    createdAt?: true
  }

  export type SalaryHistoryMaxAggregateInputType = {
    id?: true
    employeeId?: true
    previousGrossSalary?: true
    newGrossSalary?: true
    previousNetSalary?: true
    newNetSalary?: true
    grossRaisePercentage?: true
    netRaisePercentage?: true
    effectiveDate?: true
    reason?: true
    reasonComment?: true
    changedById?: true
    createdAt?: true
  }

  export type SalaryHistoryCountAggregateInputType = {
    id?: true
    employeeId?: true
    previousGrossSalary?: true
    newGrossSalary?: true
    previousNetSalary?: true
    newNetSalary?: true
    grossRaisePercentage?: true
    netRaisePercentage?: true
    effectiveDate?: true
    reason?: true
    reasonComment?: true
    changedById?: true
    createdAt?: true
    _all?: true
  }

  export type SalaryHistoryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SalaryHistory to aggregate.
     */
    where?: SalaryHistoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SalaryHistories to fetch.
     */
    orderBy?: SalaryHistoryOrderByWithRelationInput | SalaryHistoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SalaryHistoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SalaryHistories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SalaryHistories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SalaryHistories
    **/
    _count?: true | SalaryHistoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SalaryHistoryAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SalaryHistorySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SalaryHistoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SalaryHistoryMaxAggregateInputType
  }

  export type GetSalaryHistoryAggregateType<T extends SalaryHistoryAggregateArgs> = {
        [P in keyof T & keyof AggregateSalaryHistory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSalaryHistory[P]>
      : GetScalarType<T[P], AggregateSalaryHistory[P]>
  }




  export type SalaryHistoryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SalaryHistoryWhereInput
    orderBy?: SalaryHistoryOrderByWithAggregationInput | SalaryHistoryOrderByWithAggregationInput[]
    by: SalaryHistoryScalarFieldEnum[] | SalaryHistoryScalarFieldEnum
    having?: SalaryHistoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SalaryHistoryCountAggregateInputType | true
    _avg?: SalaryHistoryAvgAggregateInputType
    _sum?: SalaryHistorySumAggregateInputType
    _min?: SalaryHistoryMinAggregateInputType
    _max?: SalaryHistoryMaxAggregateInputType
  }

  export type SalaryHistoryGroupByOutputType = {
    id: string
    employeeId: string
    previousGrossSalary: Decimal
    newGrossSalary: Decimal
    previousNetSalary: Decimal | null
    newNetSalary: Decimal | null
    grossRaisePercentage: Decimal | null
    netRaisePercentage: Decimal | null
    effectiveDate: Date
    reason: $Enums.SalaryChangeReason | null
    reasonComment: string | null
    changedById: string
    createdAt: Date
    _count: SalaryHistoryCountAggregateOutputType | null
    _avg: SalaryHistoryAvgAggregateOutputType | null
    _sum: SalaryHistorySumAggregateOutputType | null
    _min: SalaryHistoryMinAggregateOutputType | null
    _max: SalaryHistoryMaxAggregateOutputType | null
  }

  type GetSalaryHistoryGroupByPayload<T extends SalaryHistoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SalaryHistoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SalaryHistoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SalaryHistoryGroupByOutputType[P]>
            : GetScalarType<T[P], SalaryHistoryGroupByOutputType[P]>
        }
      >
    >


  export type SalaryHistorySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    employeeId?: boolean
    previousGrossSalary?: boolean
    newGrossSalary?: boolean
    previousNetSalary?: boolean
    newNetSalary?: boolean
    grossRaisePercentage?: boolean
    netRaisePercentage?: boolean
    effectiveDate?: boolean
    reason?: boolean
    reasonComment?: boolean
    changedById?: boolean
    createdAt?: boolean
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["salaryHistory"]>

  export type SalaryHistorySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    employeeId?: boolean
    previousGrossSalary?: boolean
    newGrossSalary?: boolean
    previousNetSalary?: boolean
    newNetSalary?: boolean
    grossRaisePercentage?: boolean
    netRaisePercentage?: boolean
    effectiveDate?: boolean
    reason?: boolean
    reasonComment?: boolean
    changedById?: boolean
    createdAt?: boolean
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["salaryHistory"]>

  export type SalaryHistorySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    employeeId?: boolean
    previousGrossSalary?: boolean
    newGrossSalary?: boolean
    previousNetSalary?: boolean
    newNetSalary?: boolean
    grossRaisePercentage?: boolean
    netRaisePercentage?: boolean
    effectiveDate?: boolean
    reason?: boolean
    reasonComment?: boolean
    changedById?: boolean
    createdAt?: boolean
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["salaryHistory"]>

  export type SalaryHistorySelectScalar = {
    id?: boolean
    employeeId?: boolean
    previousGrossSalary?: boolean
    newGrossSalary?: boolean
    previousNetSalary?: boolean
    newNetSalary?: boolean
    grossRaisePercentage?: boolean
    netRaisePercentage?: boolean
    effectiveDate?: boolean
    reason?: boolean
    reasonComment?: boolean
    changedById?: boolean
    createdAt?: boolean
  }

  export type SalaryHistoryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "employeeId" | "previousGrossSalary" | "newGrossSalary" | "previousNetSalary" | "newNetSalary" | "grossRaisePercentage" | "netRaisePercentage" | "effectiveDate" | "reason" | "reasonComment" | "changedById" | "createdAt", ExtArgs["result"]["salaryHistory"]>
  export type SalaryHistoryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }
  export type SalaryHistoryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }
  export type SalaryHistoryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | EmployeeDefaultArgs<ExtArgs>
  }

  export type $SalaryHistoryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SalaryHistory"
    objects: {
      employee: Prisma.$EmployeePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      employeeId: string
      previousGrossSalary: Prisma.Decimal
      newGrossSalary: Prisma.Decimal
      previousNetSalary: Prisma.Decimal | null
      newNetSalary: Prisma.Decimal | null
      grossRaisePercentage: Prisma.Decimal | null
      netRaisePercentage: Prisma.Decimal | null
      effectiveDate: Date
      reason: $Enums.SalaryChangeReason | null
      reasonComment: string | null
      changedById: string
      createdAt: Date
    }, ExtArgs["result"]["salaryHistory"]>
    composites: {}
  }

  type SalaryHistoryGetPayload<S extends boolean | null | undefined | SalaryHistoryDefaultArgs> = $Result.GetResult<Prisma.$SalaryHistoryPayload, S>

  type SalaryHistoryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SalaryHistoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SalaryHistoryCountAggregateInputType | true
    }

  export interface SalaryHistoryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SalaryHistory'], meta: { name: 'SalaryHistory' } }
    /**
     * Find zero or one SalaryHistory that matches the filter.
     * @param {SalaryHistoryFindUniqueArgs} args - Arguments to find a SalaryHistory
     * @example
     * // Get one SalaryHistory
     * const salaryHistory = await prisma.salaryHistory.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SalaryHistoryFindUniqueArgs>(args: SelectSubset<T, SalaryHistoryFindUniqueArgs<ExtArgs>>): Prisma__SalaryHistoryClient<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SalaryHistory that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SalaryHistoryFindUniqueOrThrowArgs} args - Arguments to find a SalaryHistory
     * @example
     * // Get one SalaryHistory
     * const salaryHistory = await prisma.salaryHistory.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SalaryHistoryFindUniqueOrThrowArgs>(args: SelectSubset<T, SalaryHistoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SalaryHistoryClient<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SalaryHistory that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SalaryHistoryFindFirstArgs} args - Arguments to find a SalaryHistory
     * @example
     * // Get one SalaryHistory
     * const salaryHistory = await prisma.salaryHistory.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SalaryHistoryFindFirstArgs>(args?: SelectSubset<T, SalaryHistoryFindFirstArgs<ExtArgs>>): Prisma__SalaryHistoryClient<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SalaryHistory that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SalaryHistoryFindFirstOrThrowArgs} args - Arguments to find a SalaryHistory
     * @example
     * // Get one SalaryHistory
     * const salaryHistory = await prisma.salaryHistory.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SalaryHistoryFindFirstOrThrowArgs>(args?: SelectSubset<T, SalaryHistoryFindFirstOrThrowArgs<ExtArgs>>): Prisma__SalaryHistoryClient<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SalaryHistories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SalaryHistoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SalaryHistories
     * const salaryHistories = await prisma.salaryHistory.findMany()
     * 
     * // Get first 10 SalaryHistories
     * const salaryHistories = await prisma.salaryHistory.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const salaryHistoryWithIdOnly = await prisma.salaryHistory.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SalaryHistoryFindManyArgs>(args?: SelectSubset<T, SalaryHistoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SalaryHistory.
     * @param {SalaryHistoryCreateArgs} args - Arguments to create a SalaryHistory.
     * @example
     * // Create one SalaryHistory
     * const SalaryHistory = await prisma.salaryHistory.create({
     *   data: {
     *     // ... data to create a SalaryHistory
     *   }
     * })
     * 
     */
    create<T extends SalaryHistoryCreateArgs>(args: SelectSubset<T, SalaryHistoryCreateArgs<ExtArgs>>): Prisma__SalaryHistoryClient<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SalaryHistories.
     * @param {SalaryHistoryCreateManyArgs} args - Arguments to create many SalaryHistories.
     * @example
     * // Create many SalaryHistories
     * const salaryHistory = await prisma.salaryHistory.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SalaryHistoryCreateManyArgs>(args?: SelectSubset<T, SalaryHistoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SalaryHistories and returns the data saved in the database.
     * @param {SalaryHistoryCreateManyAndReturnArgs} args - Arguments to create many SalaryHistories.
     * @example
     * // Create many SalaryHistories
     * const salaryHistory = await prisma.salaryHistory.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SalaryHistories and only return the `id`
     * const salaryHistoryWithIdOnly = await prisma.salaryHistory.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SalaryHistoryCreateManyAndReturnArgs>(args?: SelectSubset<T, SalaryHistoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a SalaryHistory.
     * @param {SalaryHistoryDeleteArgs} args - Arguments to delete one SalaryHistory.
     * @example
     * // Delete one SalaryHistory
     * const SalaryHistory = await prisma.salaryHistory.delete({
     *   where: {
     *     // ... filter to delete one SalaryHistory
     *   }
     * })
     * 
     */
    delete<T extends SalaryHistoryDeleteArgs>(args: SelectSubset<T, SalaryHistoryDeleteArgs<ExtArgs>>): Prisma__SalaryHistoryClient<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SalaryHistory.
     * @param {SalaryHistoryUpdateArgs} args - Arguments to update one SalaryHistory.
     * @example
     * // Update one SalaryHistory
     * const salaryHistory = await prisma.salaryHistory.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SalaryHistoryUpdateArgs>(args: SelectSubset<T, SalaryHistoryUpdateArgs<ExtArgs>>): Prisma__SalaryHistoryClient<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SalaryHistories.
     * @param {SalaryHistoryDeleteManyArgs} args - Arguments to filter SalaryHistories to delete.
     * @example
     * // Delete a few SalaryHistories
     * const { count } = await prisma.salaryHistory.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SalaryHistoryDeleteManyArgs>(args?: SelectSubset<T, SalaryHistoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SalaryHistories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SalaryHistoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SalaryHistories
     * const salaryHistory = await prisma.salaryHistory.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SalaryHistoryUpdateManyArgs>(args: SelectSubset<T, SalaryHistoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SalaryHistories and returns the data updated in the database.
     * @param {SalaryHistoryUpdateManyAndReturnArgs} args - Arguments to update many SalaryHistories.
     * @example
     * // Update many SalaryHistories
     * const salaryHistory = await prisma.salaryHistory.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more SalaryHistories and only return the `id`
     * const salaryHistoryWithIdOnly = await prisma.salaryHistory.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SalaryHistoryUpdateManyAndReturnArgs>(args: SelectSubset<T, SalaryHistoryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one SalaryHistory.
     * @param {SalaryHistoryUpsertArgs} args - Arguments to update or create a SalaryHistory.
     * @example
     * // Update or create a SalaryHistory
     * const salaryHistory = await prisma.salaryHistory.upsert({
     *   create: {
     *     // ... data to create a SalaryHistory
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SalaryHistory we want to update
     *   }
     * })
     */
    upsert<T extends SalaryHistoryUpsertArgs>(args: SelectSubset<T, SalaryHistoryUpsertArgs<ExtArgs>>): Prisma__SalaryHistoryClient<$Result.GetResult<Prisma.$SalaryHistoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SalaryHistories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SalaryHistoryCountArgs} args - Arguments to filter SalaryHistories to count.
     * @example
     * // Count the number of SalaryHistories
     * const count = await prisma.salaryHistory.count({
     *   where: {
     *     // ... the filter for the SalaryHistories we want to count
     *   }
     * })
    **/
    count<T extends SalaryHistoryCountArgs>(
      args?: Subset<T, SalaryHistoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SalaryHistoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SalaryHistory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SalaryHistoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SalaryHistoryAggregateArgs>(args: Subset<T, SalaryHistoryAggregateArgs>): Prisma.PrismaPromise<GetSalaryHistoryAggregateType<T>>

    /**
     * Group by SalaryHistory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SalaryHistoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SalaryHistoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SalaryHistoryGroupByArgs['orderBy'] }
        : { orderBy?: SalaryHistoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SalaryHistoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSalaryHistoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SalaryHistory model
   */
  readonly fields: SalaryHistoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SalaryHistory.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SalaryHistoryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    employee<T extends EmployeeDefaultArgs<ExtArgs> = {}>(args?: Subset<T, EmployeeDefaultArgs<ExtArgs>>): Prisma__EmployeeClient<$Result.GetResult<Prisma.$EmployeePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SalaryHistory model
   */
  interface SalaryHistoryFieldRefs {
    readonly id: FieldRef<"SalaryHistory", 'String'>
    readonly employeeId: FieldRef<"SalaryHistory", 'String'>
    readonly previousGrossSalary: FieldRef<"SalaryHistory", 'Decimal'>
    readonly newGrossSalary: FieldRef<"SalaryHistory", 'Decimal'>
    readonly previousNetSalary: FieldRef<"SalaryHistory", 'Decimal'>
    readonly newNetSalary: FieldRef<"SalaryHistory", 'Decimal'>
    readonly grossRaisePercentage: FieldRef<"SalaryHistory", 'Decimal'>
    readonly netRaisePercentage: FieldRef<"SalaryHistory", 'Decimal'>
    readonly effectiveDate: FieldRef<"SalaryHistory", 'DateTime'>
    readonly reason: FieldRef<"SalaryHistory", 'SalaryChangeReason'>
    readonly reasonComment: FieldRef<"SalaryHistory", 'String'>
    readonly changedById: FieldRef<"SalaryHistory", 'String'>
    readonly createdAt: FieldRef<"SalaryHistory", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SalaryHistory findUnique
   */
  export type SalaryHistoryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    /**
     * Filter, which SalaryHistory to fetch.
     */
    where: SalaryHistoryWhereUniqueInput
  }

  /**
   * SalaryHistory findUniqueOrThrow
   */
  export type SalaryHistoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    /**
     * Filter, which SalaryHistory to fetch.
     */
    where: SalaryHistoryWhereUniqueInput
  }

  /**
   * SalaryHistory findFirst
   */
  export type SalaryHistoryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    /**
     * Filter, which SalaryHistory to fetch.
     */
    where?: SalaryHistoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SalaryHistories to fetch.
     */
    orderBy?: SalaryHistoryOrderByWithRelationInput | SalaryHistoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SalaryHistories.
     */
    cursor?: SalaryHistoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SalaryHistories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SalaryHistories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SalaryHistories.
     */
    distinct?: SalaryHistoryScalarFieldEnum | SalaryHistoryScalarFieldEnum[]
  }

  /**
   * SalaryHistory findFirstOrThrow
   */
  export type SalaryHistoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    /**
     * Filter, which SalaryHistory to fetch.
     */
    where?: SalaryHistoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SalaryHistories to fetch.
     */
    orderBy?: SalaryHistoryOrderByWithRelationInput | SalaryHistoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SalaryHistories.
     */
    cursor?: SalaryHistoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SalaryHistories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SalaryHistories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SalaryHistories.
     */
    distinct?: SalaryHistoryScalarFieldEnum | SalaryHistoryScalarFieldEnum[]
  }

  /**
   * SalaryHistory findMany
   */
  export type SalaryHistoryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    /**
     * Filter, which SalaryHistories to fetch.
     */
    where?: SalaryHistoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SalaryHistories to fetch.
     */
    orderBy?: SalaryHistoryOrderByWithRelationInput | SalaryHistoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SalaryHistories.
     */
    cursor?: SalaryHistoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SalaryHistories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SalaryHistories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SalaryHistories.
     */
    distinct?: SalaryHistoryScalarFieldEnum | SalaryHistoryScalarFieldEnum[]
  }

  /**
   * SalaryHistory create
   */
  export type SalaryHistoryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    /**
     * The data needed to create a SalaryHistory.
     */
    data: XOR<SalaryHistoryCreateInput, SalaryHistoryUncheckedCreateInput>
  }

  /**
   * SalaryHistory createMany
   */
  export type SalaryHistoryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SalaryHistories.
     */
    data: SalaryHistoryCreateManyInput | SalaryHistoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SalaryHistory createManyAndReturn
   */
  export type SalaryHistoryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * The data used to create many SalaryHistories.
     */
    data: SalaryHistoryCreateManyInput | SalaryHistoryCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * SalaryHistory update
   */
  export type SalaryHistoryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    /**
     * The data needed to update a SalaryHistory.
     */
    data: XOR<SalaryHistoryUpdateInput, SalaryHistoryUncheckedUpdateInput>
    /**
     * Choose, which SalaryHistory to update.
     */
    where: SalaryHistoryWhereUniqueInput
  }

  /**
   * SalaryHistory updateMany
   */
  export type SalaryHistoryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SalaryHistories.
     */
    data: XOR<SalaryHistoryUpdateManyMutationInput, SalaryHistoryUncheckedUpdateManyInput>
    /**
     * Filter which SalaryHistories to update
     */
    where?: SalaryHistoryWhereInput
    /**
     * Limit how many SalaryHistories to update.
     */
    limit?: number
  }

  /**
   * SalaryHistory updateManyAndReturn
   */
  export type SalaryHistoryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * The data used to update SalaryHistories.
     */
    data: XOR<SalaryHistoryUpdateManyMutationInput, SalaryHistoryUncheckedUpdateManyInput>
    /**
     * Filter which SalaryHistories to update
     */
    where?: SalaryHistoryWhereInput
    /**
     * Limit how many SalaryHistories to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * SalaryHistory upsert
   */
  export type SalaryHistoryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    /**
     * The filter to search for the SalaryHistory to update in case it exists.
     */
    where: SalaryHistoryWhereUniqueInput
    /**
     * In case the SalaryHistory found by the `where` argument doesn't exist, create a new SalaryHistory with this data.
     */
    create: XOR<SalaryHistoryCreateInput, SalaryHistoryUncheckedCreateInput>
    /**
     * In case the SalaryHistory was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SalaryHistoryUpdateInput, SalaryHistoryUncheckedUpdateInput>
  }

  /**
   * SalaryHistory delete
   */
  export type SalaryHistoryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
    /**
     * Filter which SalaryHistory to delete.
     */
    where: SalaryHistoryWhereUniqueInput
  }

  /**
   * SalaryHistory deleteMany
   */
  export type SalaryHistoryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SalaryHistories to delete
     */
    where?: SalaryHistoryWhereInput
    /**
     * Limit how many SalaryHistories to delete.
     */
    limit?: number
  }

  /**
   * SalaryHistory without action
   */
  export type SalaryHistoryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SalaryHistory
     */
    select?: SalaryHistorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SalaryHistory
     */
    omit?: SalaryHistoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SalaryHistoryInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const EnumMetaScalarFieldEnum: {
    id: 'id',
    enumName: 'enumName',
    key: 'key',
    rank: 'rank',
    label: 'label'
  };

  export type EnumMetaScalarFieldEnum = (typeof EnumMetaScalarFieldEnum)[keyof typeof EnumMetaScalarFieldEnum]


  export const BusinessUnitScalarFieldEnum: {
    id: 'id',
    name: 'name',
    address: 'address',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type BusinessUnitScalarFieldEnum = (typeof BusinessUnitScalarFieldEnum)[keyof typeof BusinessUnitScalarFieldEnum]


  export const DepartmentScalarFieldEnum: {
    id: 'id',
    name: 'name',
    code: 'code',
    description: 'description',
    headId: 'headId',
    businessUnitId: 'businessUnitId',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type DepartmentScalarFieldEnum = (typeof DepartmentScalarFieldEnum)[keyof typeof DepartmentScalarFieldEnum]


  export const TeamScalarFieldEnum: {
    id: 'id',
    name: 'name',
    code: 'code',
    description: 'description',
    departmentId: 'departmentId',
    leadId: 'leadId',
    projectFocus: 'projectFocus',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TeamScalarFieldEnum = (typeof TeamScalarFieldEnum)[keyof typeof TeamScalarFieldEnum]


  export const PositionScalarFieldEnum: {
    id: 'id',
    title: 'title',
    level: 'level',
    isActive: 'isActive',
    createdAt: 'createdAt'
  };

  export type PositionScalarFieldEnum = (typeof PositionScalarFieldEnum)[keyof typeof PositionScalarFieldEnum]


  export const EmployeeScalarFieldEnum: {
    id: 'id',
    employeeCode: 'employeeCode',
    firstName: 'firstName',
    lastName: 'lastName',
    email: 'email',
    phone: 'phone',
    dateOfBirth: 'dateOfBirth',
    hireDate: 'hireDate',
    employmentStatus: 'employmentStatus',
    contractType: 'contractType',
    grossSalary: 'grossSalary',
    netSalary: 'netSalary',
    maritalStatus: 'maritalStatus',
    educationLevel: 'educationLevel',
    educationField: 'educationField',
    positionId: 'positionId',
    departmentId: 'departmentId',
    teamId: 'teamId',
    managerId: 'managerId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type EmployeeScalarFieldEnum = (typeof EmployeeScalarFieldEnum)[keyof typeof EmployeeScalarFieldEnum]


  export const SalaryHistoryScalarFieldEnum: {
    id: 'id',
    employeeId: 'employeeId',
    previousGrossSalary: 'previousGrossSalary',
    newGrossSalary: 'newGrossSalary',
    previousNetSalary: 'previousNetSalary',
    newNetSalary: 'newNetSalary',
    grossRaisePercentage: 'grossRaisePercentage',
    netRaisePercentage: 'netRaisePercentage',
    effectiveDate: 'effectiveDate',
    reason: 'reason',
    reasonComment: 'reasonComment',
    changedById: 'changedById',
    createdAt: 'createdAt'
  };

  export type SalaryHistoryScalarFieldEnum = (typeof SalaryHistoryScalarFieldEnum)[keyof typeof SalaryHistoryScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'PositionLevel'
   */
  export type EnumPositionLevelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PositionLevel'>
    


  /**
   * Reference to a field of type 'PositionLevel[]'
   */
  export type ListEnumPositionLevelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PositionLevel[]'>
    


  /**
   * Reference to a field of type 'EmploymentStatus'
   */
  export type EnumEmploymentStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EmploymentStatus'>
    


  /**
   * Reference to a field of type 'EmploymentStatus[]'
   */
  export type ListEnumEmploymentStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EmploymentStatus[]'>
    


  /**
   * Reference to a field of type 'ContractType'
   */
  export type EnumContractTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ContractType'>
    


  /**
   * Reference to a field of type 'ContractType[]'
   */
  export type ListEnumContractTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ContractType[]'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'MaritalStatus'
   */
  export type EnumMaritalStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'MaritalStatus'>
    


  /**
   * Reference to a field of type 'MaritalStatus[]'
   */
  export type ListEnumMaritalStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'MaritalStatus[]'>
    


  /**
   * Reference to a field of type 'EducationLevel'
   */
  export type EnumEducationLevelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EducationLevel'>
    


  /**
   * Reference to a field of type 'EducationLevel[]'
   */
  export type ListEnumEducationLevelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EducationLevel[]'>
    


  /**
   * Reference to a field of type 'SalaryChangeReason'
   */
  export type EnumSalaryChangeReasonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SalaryChangeReason'>
    


  /**
   * Reference to a field of type 'SalaryChangeReason[]'
   */
  export type ListEnumSalaryChangeReasonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SalaryChangeReason[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type EnumMetaWhereInput = {
    AND?: EnumMetaWhereInput | EnumMetaWhereInput[]
    OR?: EnumMetaWhereInput[]
    NOT?: EnumMetaWhereInput | EnumMetaWhereInput[]
    id?: StringFilter<"EnumMeta"> | string
    enumName?: StringFilter<"EnumMeta"> | string
    key?: StringFilter<"EnumMeta"> | string
    rank?: IntFilter<"EnumMeta"> | number
    label?: StringFilter<"EnumMeta"> | string
  }

  export type EnumMetaOrderByWithRelationInput = {
    id?: SortOrder
    enumName?: SortOrder
    key?: SortOrder
    rank?: SortOrder
    label?: SortOrder
  }

  export type EnumMetaWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    enumName_key?: EnumMetaEnumNameKeyCompoundUniqueInput
    AND?: EnumMetaWhereInput | EnumMetaWhereInput[]
    OR?: EnumMetaWhereInput[]
    NOT?: EnumMetaWhereInput | EnumMetaWhereInput[]
    enumName?: StringFilter<"EnumMeta"> | string
    key?: StringFilter<"EnumMeta"> | string
    rank?: IntFilter<"EnumMeta"> | number
    label?: StringFilter<"EnumMeta"> | string
  }, "id" | "enumName_key">

  export type EnumMetaOrderByWithAggregationInput = {
    id?: SortOrder
    enumName?: SortOrder
    key?: SortOrder
    rank?: SortOrder
    label?: SortOrder
    _count?: EnumMetaCountOrderByAggregateInput
    _avg?: EnumMetaAvgOrderByAggregateInput
    _max?: EnumMetaMaxOrderByAggregateInput
    _min?: EnumMetaMinOrderByAggregateInput
    _sum?: EnumMetaSumOrderByAggregateInput
  }

  export type EnumMetaScalarWhereWithAggregatesInput = {
    AND?: EnumMetaScalarWhereWithAggregatesInput | EnumMetaScalarWhereWithAggregatesInput[]
    OR?: EnumMetaScalarWhereWithAggregatesInput[]
    NOT?: EnumMetaScalarWhereWithAggregatesInput | EnumMetaScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"EnumMeta"> | string
    enumName?: StringWithAggregatesFilter<"EnumMeta"> | string
    key?: StringWithAggregatesFilter<"EnumMeta"> | string
    rank?: IntWithAggregatesFilter<"EnumMeta"> | number
    label?: StringWithAggregatesFilter<"EnumMeta"> | string
  }

  export type BusinessUnitWhereInput = {
    AND?: BusinessUnitWhereInput | BusinessUnitWhereInput[]
    OR?: BusinessUnitWhereInput[]
    NOT?: BusinessUnitWhereInput | BusinessUnitWhereInput[]
    id?: StringFilter<"BusinessUnit"> | string
    name?: StringFilter<"BusinessUnit"> | string
    address?: StringFilter<"BusinessUnit"> | string
    isActive?: BoolFilter<"BusinessUnit"> | boolean
    createdAt?: DateTimeFilter<"BusinessUnit"> | Date | string
    updatedAt?: DateTimeFilter<"BusinessUnit"> | Date | string
    departments?: DepartmentListRelationFilter
  }

  export type BusinessUnitOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    address?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    departments?: DepartmentOrderByRelationAggregateInput
  }

  export type BusinessUnitWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: BusinessUnitWhereInput | BusinessUnitWhereInput[]
    OR?: BusinessUnitWhereInput[]
    NOT?: BusinessUnitWhereInput | BusinessUnitWhereInput[]
    address?: StringFilter<"BusinessUnit"> | string
    isActive?: BoolFilter<"BusinessUnit"> | boolean
    createdAt?: DateTimeFilter<"BusinessUnit"> | Date | string
    updatedAt?: DateTimeFilter<"BusinessUnit"> | Date | string
    departments?: DepartmentListRelationFilter
  }, "id" | "name">

  export type BusinessUnitOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    address?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: BusinessUnitCountOrderByAggregateInput
    _max?: BusinessUnitMaxOrderByAggregateInput
    _min?: BusinessUnitMinOrderByAggregateInput
  }

  export type BusinessUnitScalarWhereWithAggregatesInput = {
    AND?: BusinessUnitScalarWhereWithAggregatesInput | BusinessUnitScalarWhereWithAggregatesInput[]
    OR?: BusinessUnitScalarWhereWithAggregatesInput[]
    NOT?: BusinessUnitScalarWhereWithAggregatesInput | BusinessUnitScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"BusinessUnit"> | string
    name?: StringWithAggregatesFilter<"BusinessUnit"> | string
    address?: StringWithAggregatesFilter<"BusinessUnit"> | string
    isActive?: BoolWithAggregatesFilter<"BusinessUnit"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"BusinessUnit"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"BusinessUnit"> | Date | string
  }

  export type DepartmentWhereInput = {
    AND?: DepartmentWhereInput | DepartmentWhereInput[]
    OR?: DepartmentWhereInput[]
    NOT?: DepartmentWhereInput | DepartmentWhereInput[]
    id?: StringFilter<"Department"> | string
    name?: StringFilter<"Department"> | string
    code?: StringFilter<"Department"> | string
    description?: StringNullableFilter<"Department"> | string | null
    headId?: StringNullableFilter<"Department"> | string | null
    businessUnitId?: StringNullableFilter<"Department"> | string | null
    isActive?: BoolFilter<"Department"> | boolean
    createdAt?: DateTimeFilter<"Department"> | Date | string
    updatedAt?: DateTimeFilter<"Department"> | Date | string
    businessUnit?: XOR<BusinessUnitNullableScalarRelationFilter, BusinessUnitWhereInput> | null
    teams?: TeamListRelationFilter
    employees?: EmployeeListRelationFilter
  }

  export type DepartmentOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrder
    description?: SortOrderInput | SortOrder
    headId?: SortOrderInput | SortOrder
    businessUnitId?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    businessUnit?: BusinessUnitOrderByWithRelationInput
    teams?: TeamOrderByRelationAggregateInput
    employees?: EmployeeOrderByRelationAggregateInput
  }

  export type DepartmentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    code?: string
    AND?: DepartmentWhereInput | DepartmentWhereInput[]
    OR?: DepartmentWhereInput[]
    NOT?: DepartmentWhereInput | DepartmentWhereInput[]
    description?: StringNullableFilter<"Department"> | string | null
    headId?: StringNullableFilter<"Department"> | string | null
    businessUnitId?: StringNullableFilter<"Department"> | string | null
    isActive?: BoolFilter<"Department"> | boolean
    createdAt?: DateTimeFilter<"Department"> | Date | string
    updatedAt?: DateTimeFilter<"Department"> | Date | string
    businessUnit?: XOR<BusinessUnitNullableScalarRelationFilter, BusinessUnitWhereInput> | null
    teams?: TeamListRelationFilter
    employees?: EmployeeListRelationFilter
  }, "id" | "name" | "code">

  export type DepartmentOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrder
    description?: SortOrderInput | SortOrder
    headId?: SortOrderInput | SortOrder
    businessUnitId?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: DepartmentCountOrderByAggregateInput
    _max?: DepartmentMaxOrderByAggregateInput
    _min?: DepartmentMinOrderByAggregateInput
  }

  export type DepartmentScalarWhereWithAggregatesInput = {
    AND?: DepartmentScalarWhereWithAggregatesInput | DepartmentScalarWhereWithAggregatesInput[]
    OR?: DepartmentScalarWhereWithAggregatesInput[]
    NOT?: DepartmentScalarWhereWithAggregatesInput | DepartmentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Department"> | string
    name?: StringWithAggregatesFilter<"Department"> | string
    code?: StringWithAggregatesFilter<"Department"> | string
    description?: StringNullableWithAggregatesFilter<"Department"> | string | null
    headId?: StringNullableWithAggregatesFilter<"Department"> | string | null
    businessUnitId?: StringNullableWithAggregatesFilter<"Department"> | string | null
    isActive?: BoolWithAggregatesFilter<"Department"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Department"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Department"> | Date | string
  }

  export type TeamWhereInput = {
    AND?: TeamWhereInput | TeamWhereInput[]
    OR?: TeamWhereInput[]
    NOT?: TeamWhereInput | TeamWhereInput[]
    id?: StringFilter<"Team"> | string
    name?: StringFilter<"Team"> | string
    code?: StringNullableFilter<"Team"> | string | null
    description?: StringNullableFilter<"Team"> | string | null
    departmentId?: StringFilter<"Team"> | string
    leadId?: StringNullableFilter<"Team"> | string | null
    projectFocus?: StringNullableFilter<"Team"> | string | null
    isActive?: BoolFilter<"Team"> | boolean
    createdAt?: DateTimeFilter<"Team"> | Date | string
    updatedAt?: DateTimeFilter<"Team"> | Date | string
    department?: XOR<DepartmentScalarRelationFilter, DepartmentWhereInput>
    employees?: EmployeeListRelationFilter
  }

  export type TeamOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    departmentId?: SortOrder
    leadId?: SortOrderInput | SortOrder
    projectFocus?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    department?: DepartmentOrderByWithRelationInput
    employees?: EmployeeOrderByRelationAggregateInput
  }

  export type TeamWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    code?: string
    AND?: TeamWhereInput | TeamWhereInput[]
    OR?: TeamWhereInput[]
    NOT?: TeamWhereInput | TeamWhereInput[]
    name?: StringFilter<"Team"> | string
    description?: StringNullableFilter<"Team"> | string | null
    departmentId?: StringFilter<"Team"> | string
    leadId?: StringNullableFilter<"Team"> | string | null
    projectFocus?: StringNullableFilter<"Team"> | string | null
    isActive?: BoolFilter<"Team"> | boolean
    createdAt?: DateTimeFilter<"Team"> | Date | string
    updatedAt?: DateTimeFilter<"Team"> | Date | string
    department?: XOR<DepartmentScalarRelationFilter, DepartmentWhereInput>
    employees?: EmployeeListRelationFilter
  }, "id" | "code">

  export type TeamOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    departmentId?: SortOrder
    leadId?: SortOrderInput | SortOrder
    projectFocus?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TeamCountOrderByAggregateInput
    _max?: TeamMaxOrderByAggregateInput
    _min?: TeamMinOrderByAggregateInput
  }

  export type TeamScalarWhereWithAggregatesInput = {
    AND?: TeamScalarWhereWithAggregatesInput | TeamScalarWhereWithAggregatesInput[]
    OR?: TeamScalarWhereWithAggregatesInput[]
    NOT?: TeamScalarWhereWithAggregatesInput | TeamScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Team"> | string
    name?: StringWithAggregatesFilter<"Team"> | string
    code?: StringNullableWithAggregatesFilter<"Team"> | string | null
    description?: StringNullableWithAggregatesFilter<"Team"> | string | null
    departmentId?: StringWithAggregatesFilter<"Team"> | string
    leadId?: StringNullableWithAggregatesFilter<"Team"> | string | null
    projectFocus?: StringNullableWithAggregatesFilter<"Team"> | string | null
    isActive?: BoolWithAggregatesFilter<"Team"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Team"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Team"> | Date | string
  }

  export type PositionWhereInput = {
    AND?: PositionWhereInput | PositionWhereInput[]
    OR?: PositionWhereInput[]
    NOT?: PositionWhereInput | PositionWhereInput[]
    id?: StringFilter<"Position"> | string
    title?: StringFilter<"Position"> | string
    level?: EnumPositionLevelNullableFilter<"Position"> | $Enums.PositionLevel | null
    isActive?: BoolFilter<"Position"> | boolean
    createdAt?: DateTimeFilter<"Position"> | Date | string
    employees?: EmployeeListRelationFilter
  }

  export type PositionOrderByWithRelationInput = {
    id?: SortOrder
    title?: SortOrder
    level?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    employees?: EmployeeOrderByRelationAggregateInput
  }

  export type PositionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    title?: string
    AND?: PositionWhereInput | PositionWhereInput[]
    OR?: PositionWhereInput[]
    NOT?: PositionWhereInput | PositionWhereInput[]
    level?: EnumPositionLevelNullableFilter<"Position"> | $Enums.PositionLevel | null
    isActive?: BoolFilter<"Position"> | boolean
    createdAt?: DateTimeFilter<"Position"> | Date | string
    employees?: EmployeeListRelationFilter
  }, "id" | "title">

  export type PositionOrderByWithAggregationInput = {
    id?: SortOrder
    title?: SortOrder
    level?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    _count?: PositionCountOrderByAggregateInput
    _max?: PositionMaxOrderByAggregateInput
    _min?: PositionMinOrderByAggregateInput
  }

  export type PositionScalarWhereWithAggregatesInput = {
    AND?: PositionScalarWhereWithAggregatesInput | PositionScalarWhereWithAggregatesInput[]
    OR?: PositionScalarWhereWithAggregatesInput[]
    NOT?: PositionScalarWhereWithAggregatesInput | PositionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Position"> | string
    title?: StringWithAggregatesFilter<"Position"> | string
    level?: EnumPositionLevelNullableWithAggregatesFilter<"Position"> | $Enums.PositionLevel | null
    isActive?: BoolWithAggregatesFilter<"Position"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Position"> | Date | string
  }

  export type EmployeeWhereInput = {
    AND?: EmployeeWhereInput | EmployeeWhereInput[]
    OR?: EmployeeWhereInput[]
    NOT?: EmployeeWhereInput | EmployeeWhereInput[]
    id?: StringFilter<"Employee"> | string
    employeeCode?: StringFilter<"Employee"> | string
    firstName?: StringFilter<"Employee"> | string
    lastName?: StringFilter<"Employee"> | string
    email?: StringFilter<"Employee"> | string
    phone?: StringNullableFilter<"Employee"> | string | null
    dateOfBirth?: DateTimeNullableFilter<"Employee"> | Date | string | null
    hireDate?: DateTimeFilter<"Employee"> | Date | string
    employmentStatus?: EnumEmploymentStatusFilter<"Employee"> | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFilter<"Employee"> | $Enums.ContractType
    grossSalary?: DecimalNullableFilter<"Employee"> | Decimal | DecimalJsLike | number | string | null
    netSalary?: DecimalNullableFilter<"Employee"> | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: EnumMaritalStatusNullableFilter<"Employee"> | $Enums.MaritalStatus | null
    educationLevel?: EnumEducationLevelNullableFilter<"Employee"> | $Enums.EducationLevel | null
    educationField?: StringNullableFilter<"Employee"> | string | null
    positionId?: StringNullableFilter<"Employee"> | string | null
    departmentId?: StringNullableFilter<"Employee"> | string | null
    teamId?: StringNullableFilter<"Employee"> | string | null
    managerId?: StringNullableFilter<"Employee"> | string | null
    createdAt?: DateTimeFilter<"Employee"> | Date | string
    updatedAt?: DateTimeFilter<"Employee"> | Date | string
    position?: XOR<PositionNullableScalarRelationFilter, PositionWhereInput> | null
    department?: XOR<DepartmentNullableScalarRelationFilter, DepartmentWhereInput> | null
    team?: XOR<TeamNullableScalarRelationFilter, TeamWhereInput> | null
    manager?: XOR<EmployeeNullableScalarRelationFilter, EmployeeWhereInput> | null
    directReports?: EmployeeListRelationFilter
    salaryHistory?: SalaryHistoryListRelationFilter
  }

  export type EmployeeOrderByWithRelationInput = {
    id?: SortOrder
    employeeCode?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    phone?: SortOrderInput | SortOrder
    dateOfBirth?: SortOrderInput | SortOrder
    hireDate?: SortOrder
    employmentStatus?: SortOrder
    contractType?: SortOrder
    grossSalary?: SortOrderInput | SortOrder
    netSalary?: SortOrderInput | SortOrder
    maritalStatus?: SortOrderInput | SortOrder
    educationLevel?: SortOrderInput | SortOrder
    educationField?: SortOrderInput | SortOrder
    positionId?: SortOrderInput | SortOrder
    departmentId?: SortOrderInput | SortOrder
    teamId?: SortOrderInput | SortOrder
    managerId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    position?: PositionOrderByWithRelationInput
    department?: DepartmentOrderByWithRelationInput
    team?: TeamOrderByWithRelationInput
    manager?: EmployeeOrderByWithRelationInput
    directReports?: EmployeeOrderByRelationAggregateInput
    salaryHistory?: SalaryHistoryOrderByRelationAggregateInput
  }

  export type EmployeeWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    employeeCode?: string
    email?: string
    AND?: EmployeeWhereInput | EmployeeWhereInput[]
    OR?: EmployeeWhereInput[]
    NOT?: EmployeeWhereInput | EmployeeWhereInput[]
    firstName?: StringFilter<"Employee"> | string
    lastName?: StringFilter<"Employee"> | string
    phone?: StringNullableFilter<"Employee"> | string | null
    dateOfBirth?: DateTimeNullableFilter<"Employee"> | Date | string | null
    hireDate?: DateTimeFilter<"Employee"> | Date | string
    employmentStatus?: EnumEmploymentStatusFilter<"Employee"> | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFilter<"Employee"> | $Enums.ContractType
    grossSalary?: DecimalNullableFilter<"Employee"> | Decimal | DecimalJsLike | number | string | null
    netSalary?: DecimalNullableFilter<"Employee"> | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: EnumMaritalStatusNullableFilter<"Employee"> | $Enums.MaritalStatus | null
    educationLevel?: EnumEducationLevelNullableFilter<"Employee"> | $Enums.EducationLevel | null
    educationField?: StringNullableFilter<"Employee"> | string | null
    positionId?: StringNullableFilter<"Employee"> | string | null
    departmentId?: StringNullableFilter<"Employee"> | string | null
    teamId?: StringNullableFilter<"Employee"> | string | null
    managerId?: StringNullableFilter<"Employee"> | string | null
    createdAt?: DateTimeFilter<"Employee"> | Date | string
    updatedAt?: DateTimeFilter<"Employee"> | Date | string
    position?: XOR<PositionNullableScalarRelationFilter, PositionWhereInput> | null
    department?: XOR<DepartmentNullableScalarRelationFilter, DepartmentWhereInput> | null
    team?: XOR<TeamNullableScalarRelationFilter, TeamWhereInput> | null
    manager?: XOR<EmployeeNullableScalarRelationFilter, EmployeeWhereInput> | null
    directReports?: EmployeeListRelationFilter
    salaryHistory?: SalaryHistoryListRelationFilter
  }, "id" | "employeeCode" | "email">

  export type EmployeeOrderByWithAggregationInput = {
    id?: SortOrder
    employeeCode?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    phone?: SortOrderInput | SortOrder
    dateOfBirth?: SortOrderInput | SortOrder
    hireDate?: SortOrder
    employmentStatus?: SortOrder
    contractType?: SortOrder
    grossSalary?: SortOrderInput | SortOrder
    netSalary?: SortOrderInput | SortOrder
    maritalStatus?: SortOrderInput | SortOrder
    educationLevel?: SortOrderInput | SortOrder
    educationField?: SortOrderInput | SortOrder
    positionId?: SortOrderInput | SortOrder
    departmentId?: SortOrderInput | SortOrder
    teamId?: SortOrderInput | SortOrder
    managerId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: EmployeeCountOrderByAggregateInput
    _avg?: EmployeeAvgOrderByAggregateInput
    _max?: EmployeeMaxOrderByAggregateInput
    _min?: EmployeeMinOrderByAggregateInput
    _sum?: EmployeeSumOrderByAggregateInput
  }

  export type EmployeeScalarWhereWithAggregatesInput = {
    AND?: EmployeeScalarWhereWithAggregatesInput | EmployeeScalarWhereWithAggregatesInput[]
    OR?: EmployeeScalarWhereWithAggregatesInput[]
    NOT?: EmployeeScalarWhereWithAggregatesInput | EmployeeScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Employee"> | string
    employeeCode?: StringWithAggregatesFilter<"Employee"> | string
    firstName?: StringWithAggregatesFilter<"Employee"> | string
    lastName?: StringWithAggregatesFilter<"Employee"> | string
    email?: StringWithAggregatesFilter<"Employee"> | string
    phone?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    dateOfBirth?: DateTimeNullableWithAggregatesFilter<"Employee"> | Date | string | null
    hireDate?: DateTimeWithAggregatesFilter<"Employee"> | Date | string
    employmentStatus?: EnumEmploymentStatusWithAggregatesFilter<"Employee"> | $Enums.EmploymentStatus
    contractType?: EnumContractTypeWithAggregatesFilter<"Employee"> | $Enums.ContractType
    grossSalary?: DecimalNullableWithAggregatesFilter<"Employee"> | Decimal | DecimalJsLike | number | string | null
    netSalary?: DecimalNullableWithAggregatesFilter<"Employee"> | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: EnumMaritalStatusNullableWithAggregatesFilter<"Employee"> | $Enums.MaritalStatus | null
    educationLevel?: EnumEducationLevelNullableWithAggregatesFilter<"Employee"> | $Enums.EducationLevel | null
    educationField?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    positionId?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    departmentId?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    teamId?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    managerId?: StringNullableWithAggregatesFilter<"Employee"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Employee"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Employee"> | Date | string
  }

  export type SalaryHistoryWhereInput = {
    AND?: SalaryHistoryWhereInput | SalaryHistoryWhereInput[]
    OR?: SalaryHistoryWhereInput[]
    NOT?: SalaryHistoryWhereInput | SalaryHistoryWhereInput[]
    id?: StringFilter<"SalaryHistory"> | string
    employeeId?: StringFilter<"SalaryHistory"> | string
    previousGrossSalary?: DecimalFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string
    previousNetSalary?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFilter<"SalaryHistory"> | Date | string
    reason?: EnumSalaryChangeReasonNullableFilter<"SalaryHistory"> | $Enums.SalaryChangeReason | null
    reasonComment?: StringNullableFilter<"SalaryHistory"> | string | null
    changedById?: StringFilter<"SalaryHistory"> | string
    createdAt?: DateTimeFilter<"SalaryHistory"> | Date | string
    employee?: XOR<EmployeeScalarRelationFilter, EmployeeWhereInput>
  }

  export type SalaryHistoryOrderByWithRelationInput = {
    id?: SortOrder
    employeeId?: SortOrder
    previousGrossSalary?: SortOrder
    newGrossSalary?: SortOrder
    previousNetSalary?: SortOrderInput | SortOrder
    newNetSalary?: SortOrderInput | SortOrder
    grossRaisePercentage?: SortOrderInput | SortOrder
    netRaisePercentage?: SortOrderInput | SortOrder
    effectiveDate?: SortOrder
    reason?: SortOrderInput | SortOrder
    reasonComment?: SortOrderInput | SortOrder
    changedById?: SortOrder
    createdAt?: SortOrder
    employee?: EmployeeOrderByWithRelationInput
  }

  export type SalaryHistoryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: SalaryHistoryWhereInput | SalaryHistoryWhereInput[]
    OR?: SalaryHistoryWhereInput[]
    NOT?: SalaryHistoryWhereInput | SalaryHistoryWhereInput[]
    employeeId?: StringFilter<"SalaryHistory"> | string
    previousGrossSalary?: DecimalFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string
    previousNetSalary?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFilter<"SalaryHistory"> | Date | string
    reason?: EnumSalaryChangeReasonNullableFilter<"SalaryHistory"> | $Enums.SalaryChangeReason | null
    reasonComment?: StringNullableFilter<"SalaryHistory"> | string | null
    changedById?: StringFilter<"SalaryHistory"> | string
    createdAt?: DateTimeFilter<"SalaryHistory"> | Date | string
    employee?: XOR<EmployeeScalarRelationFilter, EmployeeWhereInput>
  }, "id">

  export type SalaryHistoryOrderByWithAggregationInput = {
    id?: SortOrder
    employeeId?: SortOrder
    previousGrossSalary?: SortOrder
    newGrossSalary?: SortOrder
    previousNetSalary?: SortOrderInput | SortOrder
    newNetSalary?: SortOrderInput | SortOrder
    grossRaisePercentage?: SortOrderInput | SortOrder
    netRaisePercentage?: SortOrderInput | SortOrder
    effectiveDate?: SortOrder
    reason?: SortOrderInput | SortOrder
    reasonComment?: SortOrderInput | SortOrder
    changedById?: SortOrder
    createdAt?: SortOrder
    _count?: SalaryHistoryCountOrderByAggregateInput
    _avg?: SalaryHistoryAvgOrderByAggregateInput
    _max?: SalaryHistoryMaxOrderByAggregateInput
    _min?: SalaryHistoryMinOrderByAggregateInput
    _sum?: SalaryHistorySumOrderByAggregateInput
  }

  export type SalaryHistoryScalarWhereWithAggregatesInput = {
    AND?: SalaryHistoryScalarWhereWithAggregatesInput | SalaryHistoryScalarWhereWithAggregatesInput[]
    OR?: SalaryHistoryScalarWhereWithAggregatesInput[]
    NOT?: SalaryHistoryScalarWhereWithAggregatesInput | SalaryHistoryScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"SalaryHistory"> | string
    employeeId?: StringWithAggregatesFilter<"SalaryHistory"> | string
    previousGrossSalary?: DecimalWithAggregatesFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalWithAggregatesFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string
    previousNetSalary?: DecimalNullableWithAggregatesFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: DecimalNullableWithAggregatesFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: DecimalNullableWithAggregatesFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: DecimalNullableWithAggregatesFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeWithAggregatesFilter<"SalaryHistory"> | Date | string
    reason?: EnumSalaryChangeReasonNullableWithAggregatesFilter<"SalaryHistory"> | $Enums.SalaryChangeReason | null
    reasonComment?: StringNullableWithAggregatesFilter<"SalaryHistory"> | string | null
    changedById?: StringWithAggregatesFilter<"SalaryHistory"> | string
    createdAt?: DateTimeWithAggregatesFilter<"SalaryHistory"> | Date | string
  }

  export type EnumMetaCreateInput = {
    id?: string
    enumName: string
    key: string
    rank: number
    label: string
  }

  export type EnumMetaUncheckedCreateInput = {
    id?: string
    enumName: string
    key: string
    rank: number
    label: string
  }

  export type EnumMetaUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    enumName?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    rank?: IntFieldUpdateOperationsInput | number
    label?: StringFieldUpdateOperationsInput | string
  }

  export type EnumMetaUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    enumName?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    rank?: IntFieldUpdateOperationsInput | number
    label?: StringFieldUpdateOperationsInput | string
  }

  export type EnumMetaCreateManyInput = {
    id?: string
    enumName: string
    key: string
    rank: number
    label: string
  }

  export type EnumMetaUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    enumName?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    rank?: IntFieldUpdateOperationsInput | number
    label?: StringFieldUpdateOperationsInput | string
  }

  export type EnumMetaUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    enumName?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    rank?: IntFieldUpdateOperationsInput | number
    label?: StringFieldUpdateOperationsInput | string
  }

  export type BusinessUnitCreateInput = {
    id?: string
    name: string
    address: string
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    departments?: DepartmentCreateNestedManyWithoutBusinessUnitInput
  }

  export type BusinessUnitUncheckedCreateInput = {
    id?: string
    name: string
    address: string
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    departments?: DepartmentUncheckedCreateNestedManyWithoutBusinessUnitInput
  }

  export type BusinessUnitUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    departments?: DepartmentUpdateManyWithoutBusinessUnitNestedInput
  }

  export type BusinessUnitUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    departments?: DepartmentUncheckedUpdateManyWithoutBusinessUnitNestedInput
  }

  export type BusinessUnitCreateManyInput = {
    id?: string
    name: string
    address: string
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BusinessUnitUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BusinessUnitUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DepartmentCreateInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    businessUnit?: BusinessUnitCreateNestedOneWithoutDepartmentsInput
    teams?: TeamCreateNestedManyWithoutDepartmentInput
    employees?: EmployeeCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentUncheckedCreateInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    businessUnitId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    teams?: TeamUncheckedCreateNestedManyWithoutDepartmentInput
    employees?: EmployeeUncheckedCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    businessUnit?: BusinessUnitUpdateOneWithoutDepartmentsNestedInput
    teams?: TeamUpdateManyWithoutDepartmentNestedInput
    employees?: EmployeeUpdateManyWithoutDepartmentNestedInput
  }

  export type DepartmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    businessUnitId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    teams?: TeamUncheckedUpdateManyWithoutDepartmentNestedInput
    employees?: EmployeeUncheckedUpdateManyWithoutDepartmentNestedInput
  }

  export type DepartmentCreateManyInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    businessUnitId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DepartmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DepartmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    businessUnitId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamCreateInput = {
    id?: string
    name: string
    code?: string | null
    description?: string | null
    leadId?: string | null
    projectFocus?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    department: DepartmentCreateNestedOneWithoutTeamsInput
    employees?: EmployeeCreateNestedManyWithoutTeamInput
  }

  export type TeamUncheckedCreateInput = {
    id?: string
    name: string
    code?: string | null
    description?: string | null
    departmentId: string
    leadId?: string | null
    projectFocus?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    employees?: EmployeeUncheckedCreateNestedManyWithoutTeamInput
  }

  export type TeamUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    leadId?: NullableStringFieldUpdateOperationsInput | string | null
    projectFocus?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    department?: DepartmentUpdateOneRequiredWithoutTeamsNestedInput
    employees?: EmployeeUpdateManyWithoutTeamNestedInput
  }

  export type TeamUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: StringFieldUpdateOperationsInput | string
    leadId?: NullableStringFieldUpdateOperationsInput | string | null
    projectFocus?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employees?: EmployeeUncheckedUpdateManyWithoutTeamNestedInput
  }

  export type TeamCreateManyInput = {
    id?: string
    name: string
    code?: string | null
    description?: string | null
    departmentId: string
    leadId?: string | null
    projectFocus?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TeamUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    leadId?: NullableStringFieldUpdateOperationsInput | string | null
    projectFocus?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: StringFieldUpdateOperationsInput | string
    leadId?: NullableStringFieldUpdateOperationsInput | string | null
    projectFocus?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PositionCreateInput = {
    id?: string
    title: string
    level?: $Enums.PositionLevel | null
    isActive?: boolean
    createdAt?: Date | string
    employees?: EmployeeCreateNestedManyWithoutPositionInput
  }

  export type PositionUncheckedCreateInput = {
    id?: string
    title: string
    level?: $Enums.PositionLevel | null
    isActive?: boolean
    createdAt?: Date | string
    employees?: EmployeeUncheckedCreateNestedManyWithoutPositionInput
  }

  export type PositionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    level?: NullableEnumPositionLevelFieldUpdateOperationsInput | $Enums.PositionLevel | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employees?: EmployeeUpdateManyWithoutPositionNestedInput
  }

  export type PositionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    level?: NullableEnumPositionLevelFieldUpdateOperationsInput | $Enums.PositionLevel | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employees?: EmployeeUncheckedUpdateManyWithoutPositionNestedInput
  }

  export type PositionCreateManyInput = {
    id?: string
    title: string
    level?: $Enums.PositionLevel | null
    isActive?: boolean
    createdAt?: Date | string
  }

  export type PositionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    level?: NullableEnumPositionLevelFieldUpdateOperationsInput | $Enums.PositionLevel | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PositionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    level?: NullableEnumPositionLevelFieldUpdateOperationsInput | $Enums.PositionLevel | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmployeeCreateInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    position?: PositionCreateNestedOneWithoutEmployeesInput
    department?: DepartmentCreateNestedOneWithoutEmployeesInput
    team?: TeamCreateNestedOneWithoutEmployeesInput
    manager?: EmployeeCreateNestedOneWithoutDirectReportsInput
    directReports?: EmployeeCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUncheckedCreateInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    departmentId?: string | null
    teamId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    directReports?: EmployeeUncheckedCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    position?: PositionUpdateOneWithoutEmployeesNestedInput
    department?: DepartmentUpdateOneWithoutEmployeesNestedInput
    team?: TeamUpdateOneWithoutEmployeesNestedInput
    manager?: EmployeeUpdateOneWithoutDirectReportsNestedInput
    directReports?: EmployeeUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    directReports?: EmployeeUncheckedUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeCreateManyInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    departmentId?: string | null
    teamId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type EmployeeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmployeeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SalaryHistoryCreateInput = {
    id?: string
    previousGrossSalary: Decimal | DecimalJsLike | number | string
    newGrossSalary: Decimal | DecimalJsLike | number | string
    previousNetSalary?: Decimal | DecimalJsLike | number | string | null
    newNetSalary?: Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    effectiveDate: Date | string
    reason?: $Enums.SalaryChangeReason | null
    reasonComment?: string | null
    changedById: string
    createdAt?: Date | string
    employee: EmployeeCreateNestedOneWithoutSalaryHistoryInput
  }

  export type SalaryHistoryUncheckedCreateInput = {
    id?: string
    employeeId: string
    previousGrossSalary: Decimal | DecimalJsLike | number | string
    newGrossSalary: Decimal | DecimalJsLike | number | string
    previousNetSalary?: Decimal | DecimalJsLike | number | string | null
    newNetSalary?: Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    effectiveDate: Date | string
    reason?: $Enums.SalaryChangeReason | null
    reasonComment?: string | null
    changedById: string
    createdAt?: Date | string
  }

  export type SalaryHistoryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    previousGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    previousNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableEnumSalaryChangeReasonFieldUpdateOperationsInput | $Enums.SalaryChangeReason | null
    reasonComment?: NullableStringFieldUpdateOperationsInput | string | null
    changedById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employee?: EmployeeUpdateOneRequiredWithoutSalaryHistoryNestedInput
  }

  export type SalaryHistoryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeId?: StringFieldUpdateOperationsInput | string
    previousGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    previousNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableEnumSalaryChangeReasonFieldUpdateOperationsInput | $Enums.SalaryChangeReason | null
    reasonComment?: NullableStringFieldUpdateOperationsInput | string | null
    changedById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SalaryHistoryCreateManyInput = {
    id?: string
    employeeId: string
    previousGrossSalary: Decimal | DecimalJsLike | number | string
    newGrossSalary: Decimal | DecimalJsLike | number | string
    previousNetSalary?: Decimal | DecimalJsLike | number | string | null
    newNetSalary?: Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    effectiveDate: Date | string
    reason?: $Enums.SalaryChangeReason | null
    reasonComment?: string | null
    changedById: string
    createdAt?: Date | string
  }

  export type SalaryHistoryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    previousGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    previousNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableEnumSalaryChangeReasonFieldUpdateOperationsInput | $Enums.SalaryChangeReason | null
    reasonComment?: NullableStringFieldUpdateOperationsInput | string | null
    changedById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SalaryHistoryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeId?: StringFieldUpdateOperationsInput | string
    previousGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    previousNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableEnumSalaryChangeReasonFieldUpdateOperationsInput | $Enums.SalaryChangeReason | null
    reasonComment?: NullableStringFieldUpdateOperationsInput | string | null
    changedById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type EnumMetaEnumNameKeyCompoundUniqueInput = {
    enumName: string
    key: string
  }

  export type EnumMetaCountOrderByAggregateInput = {
    id?: SortOrder
    enumName?: SortOrder
    key?: SortOrder
    rank?: SortOrder
    label?: SortOrder
  }

  export type EnumMetaAvgOrderByAggregateInput = {
    rank?: SortOrder
  }

  export type EnumMetaMaxOrderByAggregateInput = {
    id?: SortOrder
    enumName?: SortOrder
    key?: SortOrder
    rank?: SortOrder
    label?: SortOrder
  }

  export type EnumMetaMinOrderByAggregateInput = {
    id?: SortOrder
    enumName?: SortOrder
    key?: SortOrder
    rank?: SortOrder
    label?: SortOrder
  }

  export type EnumMetaSumOrderByAggregateInput = {
    rank?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type DepartmentListRelationFilter = {
    every?: DepartmentWhereInput
    some?: DepartmentWhereInput
    none?: DepartmentWhereInput
  }

  export type DepartmentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type BusinessUnitCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    address?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BusinessUnitMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    address?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BusinessUnitMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    address?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type BusinessUnitNullableScalarRelationFilter = {
    is?: BusinessUnitWhereInput | null
    isNot?: BusinessUnitWhereInput | null
  }

  export type TeamListRelationFilter = {
    every?: TeamWhereInput
    some?: TeamWhereInput
    none?: TeamWhereInput
  }

  export type EmployeeListRelationFilter = {
    every?: EmployeeWhereInput
    some?: EmployeeWhereInput
    none?: EmployeeWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type TeamOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type EmployeeOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type DepartmentCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrder
    description?: SortOrder
    headId?: SortOrder
    businessUnitId?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DepartmentMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrder
    description?: SortOrder
    headId?: SortOrder
    businessUnitId?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DepartmentMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrder
    description?: SortOrder
    headId?: SortOrder
    businessUnitId?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DepartmentScalarRelationFilter = {
    is?: DepartmentWhereInput
    isNot?: DepartmentWhereInput
  }

  export type TeamCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrder
    description?: SortOrder
    departmentId?: SortOrder
    leadId?: SortOrder
    projectFocus?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TeamMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrder
    description?: SortOrder
    departmentId?: SortOrder
    leadId?: SortOrder
    projectFocus?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TeamMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    code?: SortOrder
    description?: SortOrder
    departmentId?: SortOrder
    leadId?: SortOrder
    projectFocus?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumPositionLevelNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.PositionLevel | EnumPositionLevelFieldRefInput<$PrismaModel> | null
    in?: $Enums.PositionLevel[] | ListEnumPositionLevelFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.PositionLevel[] | ListEnumPositionLevelFieldRefInput<$PrismaModel> | null
    not?: NestedEnumPositionLevelNullableFilter<$PrismaModel> | $Enums.PositionLevel | null
  }

  export type PositionCountOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    level?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type PositionMaxOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    level?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type PositionMinOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    level?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type EnumPositionLevelNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PositionLevel | EnumPositionLevelFieldRefInput<$PrismaModel> | null
    in?: $Enums.PositionLevel[] | ListEnumPositionLevelFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.PositionLevel[] | ListEnumPositionLevelFieldRefInput<$PrismaModel> | null
    not?: NestedEnumPositionLevelNullableWithAggregatesFilter<$PrismaModel> | $Enums.PositionLevel | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumPositionLevelNullableFilter<$PrismaModel>
    _max?: NestedEnumPositionLevelNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type EnumEmploymentStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.EmploymentStatus | EnumEmploymentStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EmploymentStatus[] | ListEnumEmploymentStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmploymentStatus[] | ListEnumEmploymentStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEmploymentStatusFilter<$PrismaModel> | $Enums.EmploymentStatus
  }

  export type EnumContractTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.ContractType | EnumContractTypeFieldRefInput<$PrismaModel>
    in?: $Enums.ContractType[] | ListEnumContractTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.ContractType[] | ListEnumContractTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumContractTypeFilter<$PrismaModel> | $Enums.ContractType
  }

  export type DecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type EnumMaritalStatusNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.MaritalStatus | EnumMaritalStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumMaritalStatusNullableFilter<$PrismaModel> | $Enums.MaritalStatus | null
  }

  export type EnumEducationLevelNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.EducationLevel | EnumEducationLevelFieldRefInput<$PrismaModel> | null
    in?: $Enums.EducationLevel[] | ListEnumEducationLevelFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.EducationLevel[] | ListEnumEducationLevelFieldRefInput<$PrismaModel> | null
    not?: NestedEnumEducationLevelNullableFilter<$PrismaModel> | $Enums.EducationLevel | null
  }

  export type PositionNullableScalarRelationFilter = {
    is?: PositionWhereInput | null
    isNot?: PositionWhereInput | null
  }

  export type DepartmentNullableScalarRelationFilter = {
    is?: DepartmentWhereInput | null
    isNot?: DepartmentWhereInput | null
  }

  export type TeamNullableScalarRelationFilter = {
    is?: TeamWhereInput | null
    isNot?: TeamWhereInput | null
  }

  export type EmployeeNullableScalarRelationFilter = {
    is?: EmployeeWhereInput | null
    isNot?: EmployeeWhereInput | null
  }

  export type SalaryHistoryListRelationFilter = {
    every?: SalaryHistoryWhereInput
    some?: SalaryHistoryWhereInput
    none?: SalaryHistoryWhereInput
  }

  export type SalaryHistoryOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type EmployeeCountOrderByAggregateInput = {
    id?: SortOrder
    employeeCode?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    dateOfBirth?: SortOrder
    hireDate?: SortOrder
    employmentStatus?: SortOrder
    contractType?: SortOrder
    grossSalary?: SortOrder
    netSalary?: SortOrder
    maritalStatus?: SortOrder
    educationLevel?: SortOrder
    educationField?: SortOrder
    positionId?: SortOrder
    departmentId?: SortOrder
    teamId?: SortOrder
    managerId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EmployeeAvgOrderByAggregateInput = {
    grossSalary?: SortOrder
    netSalary?: SortOrder
  }

  export type EmployeeMaxOrderByAggregateInput = {
    id?: SortOrder
    employeeCode?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    dateOfBirth?: SortOrder
    hireDate?: SortOrder
    employmentStatus?: SortOrder
    contractType?: SortOrder
    grossSalary?: SortOrder
    netSalary?: SortOrder
    maritalStatus?: SortOrder
    educationLevel?: SortOrder
    educationField?: SortOrder
    positionId?: SortOrder
    departmentId?: SortOrder
    teamId?: SortOrder
    managerId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EmployeeMinOrderByAggregateInput = {
    id?: SortOrder
    employeeCode?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    dateOfBirth?: SortOrder
    hireDate?: SortOrder
    employmentStatus?: SortOrder
    contractType?: SortOrder
    grossSalary?: SortOrder
    netSalary?: SortOrder
    maritalStatus?: SortOrder
    educationLevel?: SortOrder
    educationField?: SortOrder
    positionId?: SortOrder
    departmentId?: SortOrder
    teamId?: SortOrder
    managerId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EmployeeSumOrderByAggregateInput = {
    grossSalary?: SortOrder
    netSalary?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type EnumEmploymentStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EmploymentStatus | EnumEmploymentStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EmploymentStatus[] | ListEnumEmploymentStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmploymentStatus[] | ListEnumEmploymentStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEmploymentStatusWithAggregatesFilter<$PrismaModel> | $Enums.EmploymentStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEmploymentStatusFilter<$PrismaModel>
    _max?: NestedEnumEmploymentStatusFilter<$PrismaModel>
  }

  export type EnumContractTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ContractType | EnumContractTypeFieldRefInput<$PrismaModel>
    in?: $Enums.ContractType[] | ListEnumContractTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.ContractType[] | ListEnumContractTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumContractTypeWithAggregatesFilter<$PrismaModel> | $Enums.ContractType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumContractTypeFilter<$PrismaModel>
    _max?: NestedEnumContractTypeFilter<$PrismaModel>
  }

  export type DecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type EnumMaritalStatusNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.MaritalStatus | EnumMaritalStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumMaritalStatusNullableWithAggregatesFilter<$PrismaModel> | $Enums.MaritalStatus | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumMaritalStatusNullableFilter<$PrismaModel>
    _max?: NestedEnumMaritalStatusNullableFilter<$PrismaModel>
  }

  export type EnumEducationLevelNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EducationLevel | EnumEducationLevelFieldRefInput<$PrismaModel> | null
    in?: $Enums.EducationLevel[] | ListEnumEducationLevelFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.EducationLevel[] | ListEnumEducationLevelFieldRefInput<$PrismaModel> | null
    not?: NestedEnumEducationLevelNullableWithAggregatesFilter<$PrismaModel> | $Enums.EducationLevel | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumEducationLevelNullableFilter<$PrismaModel>
    _max?: NestedEnumEducationLevelNullableFilter<$PrismaModel>
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type EnumSalaryChangeReasonNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.SalaryChangeReason | EnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    in?: $Enums.SalaryChangeReason[] | ListEnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.SalaryChangeReason[] | ListEnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    not?: NestedEnumSalaryChangeReasonNullableFilter<$PrismaModel> | $Enums.SalaryChangeReason | null
  }

  export type EmployeeScalarRelationFilter = {
    is?: EmployeeWhereInput
    isNot?: EmployeeWhereInput
  }

  export type SalaryHistoryCountOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
    previousGrossSalary?: SortOrder
    newGrossSalary?: SortOrder
    previousNetSalary?: SortOrder
    newNetSalary?: SortOrder
    grossRaisePercentage?: SortOrder
    netRaisePercentage?: SortOrder
    effectiveDate?: SortOrder
    reason?: SortOrder
    reasonComment?: SortOrder
    changedById?: SortOrder
    createdAt?: SortOrder
  }

  export type SalaryHistoryAvgOrderByAggregateInput = {
    previousGrossSalary?: SortOrder
    newGrossSalary?: SortOrder
    previousNetSalary?: SortOrder
    newNetSalary?: SortOrder
    grossRaisePercentage?: SortOrder
    netRaisePercentage?: SortOrder
  }

  export type SalaryHistoryMaxOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
    previousGrossSalary?: SortOrder
    newGrossSalary?: SortOrder
    previousNetSalary?: SortOrder
    newNetSalary?: SortOrder
    grossRaisePercentage?: SortOrder
    netRaisePercentage?: SortOrder
    effectiveDate?: SortOrder
    reason?: SortOrder
    reasonComment?: SortOrder
    changedById?: SortOrder
    createdAt?: SortOrder
  }

  export type SalaryHistoryMinOrderByAggregateInput = {
    id?: SortOrder
    employeeId?: SortOrder
    previousGrossSalary?: SortOrder
    newGrossSalary?: SortOrder
    previousNetSalary?: SortOrder
    newNetSalary?: SortOrder
    grossRaisePercentage?: SortOrder
    netRaisePercentage?: SortOrder
    effectiveDate?: SortOrder
    reason?: SortOrder
    reasonComment?: SortOrder
    changedById?: SortOrder
    createdAt?: SortOrder
  }

  export type SalaryHistorySumOrderByAggregateInput = {
    previousGrossSalary?: SortOrder
    newGrossSalary?: SortOrder
    previousNetSalary?: SortOrder
    newNetSalary?: SortOrder
    grossRaisePercentage?: SortOrder
    netRaisePercentage?: SortOrder
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type EnumSalaryChangeReasonNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SalaryChangeReason | EnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    in?: $Enums.SalaryChangeReason[] | ListEnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.SalaryChangeReason[] | ListEnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    not?: NestedEnumSalaryChangeReasonNullableWithAggregatesFilter<$PrismaModel> | $Enums.SalaryChangeReason | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumSalaryChangeReasonNullableFilter<$PrismaModel>
    _max?: NestedEnumSalaryChangeReasonNullableFilter<$PrismaModel>
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DepartmentCreateNestedManyWithoutBusinessUnitInput = {
    create?: XOR<DepartmentCreateWithoutBusinessUnitInput, DepartmentUncheckedCreateWithoutBusinessUnitInput> | DepartmentCreateWithoutBusinessUnitInput[] | DepartmentUncheckedCreateWithoutBusinessUnitInput[]
    connectOrCreate?: DepartmentCreateOrConnectWithoutBusinessUnitInput | DepartmentCreateOrConnectWithoutBusinessUnitInput[]
    createMany?: DepartmentCreateManyBusinessUnitInputEnvelope
    connect?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
  }

  export type DepartmentUncheckedCreateNestedManyWithoutBusinessUnitInput = {
    create?: XOR<DepartmentCreateWithoutBusinessUnitInput, DepartmentUncheckedCreateWithoutBusinessUnitInput> | DepartmentCreateWithoutBusinessUnitInput[] | DepartmentUncheckedCreateWithoutBusinessUnitInput[]
    connectOrCreate?: DepartmentCreateOrConnectWithoutBusinessUnitInput | DepartmentCreateOrConnectWithoutBusinessUnitInput[]
    createMany?: DepartmentCreateManyBusinessUnitInputEnvelope
    connect?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type DepartmentUpdateManyWithoutBusinessUnitNestedInput = {
    create?: XOR<DepartmentCreateWithoutBusinessUnitInput, DepartmentUncheckedCreateWithoutBusinessUnitInput> | DepartmentCreateWithoutBusinessUnitInput[] | DepartmentUncheckedCreateWithoutBusinessUnitInput[]
    connectOrCreate?: DepartmentCreateOrConnectWithoutBusinessUnitInput | DepartmentCreateOrConnectWithoutBusinessUnitInput[]
    upsert?: DepartmentUpsertWithWhereUniqueWithoutBusinessUnitInput | DepartmentUpsertWithWhereUniqueWithoutBusinessUnitInput[]
    createMany?: DepartmentCreateManyBusinessUnitInputEnvelope
    set?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
    disconnect?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
    delete?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
    connect?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
    update?: DepartmentUpdateWithWhereUniqueWithoutBusinessUnitInput | DepartmentUpdateWithWhereUniqueWithoutBusinessUnitInput[]
    updateMany?: DepartmentUpdateManyWithWhereWithoutBusinessUnitInput | DepartmentUpdateManyWithWhereWithoutBusinessUnitInput[]
    deleteMany?: DepartmentScalarWhereInput | DepartmentScalarWhereInput[]
  }

  export type DepartmentUncheckedUpdateManyWithoutBusinessUnitNestedInput = {
    create?: XOR<DepartmentCreateWithoutBusinessUnitInput, DepartmentUncheckedCreateWithoutBusinessUnitInput> | DepartmentCreateWithoutBusinessUnitInput[] | DepartmentUncheckedCreateWithoutBusinessUnitInput[]
    connectOrCreate?: DepartmentCreateOrConnectWithoutBusinessUnitInput | DepartmentCreateOrConnectWithoutBusinessUnitInput[]
    upsert?: DepartmentUpsertWithWhereUniqueWithoutBusinessUnitInput | DepartmentUpsertWithWhereUniqueWithoutBusinessUnitInput[]
    createMany?: DepartmentCreateManyBusinessUnitInputEnvelope
    set?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
    disconnect?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
    delete?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
    connect?: DepartmentWhereUniqueInput | DepartmentWhereUniqueInput[]
    update?: DepartmentUpdateWithWhereUniqueWithoutBusinessUnitInput | DepartmentUpdateWithWhereUniqueWithoutBusinessUnitInput[]
    updateMany?: DepartmentUpdateManyWithWhereWithoutBusinessUnitInput | DepartmentUpdateManyWithWhereWithoutBusinessUnitInput[]
    deleteMany?: DepartmentScalarWhereInput | DepartmentScalarWhereInput[]
  }

  export type BusinessUnitCreateNestedOneWithoutDepartmentsInput = {
    create?: XOR<BusinessUnitCreateWithoutDepartmentsInput, BusinessUnitUncheckedCreateWithoutDepartmentsInput>
    connectOrCreate?: BusinessUnitCreateOrConnectWithoutDepartmentsInput
    connect?: BusinessUnitWhereUniqueInput
  }

  export type TeamCreateNestedManyWithoutDepartmentInput = {
    create?: XOR<TeamCreateWithoutDepartmentInput, TeamUncheckedCreateWithoutDepartmentInput> | TeamCreateWithoutDepartmentInput[] | TeamUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: TeamCreateOrConnectWithoutDepartmentInput | TeamCreateOrConnectWithoutDepartmentInput[]
    createMany?: TeamCreateManyDepartmentInputEnvelope
    connect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
  }

  export type EmployeeCreateNestedManyWithoutDepartmentInput = {
    create?: XOR<EmployeeCreateWithoutDepartmentInput, EmployeeUncheckedCreateWithoutDepartmentInput> | EmployeeCreateWithoutDepartmentInput[] | EmployeeUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutDepartmentInput | EmployeeCreateOrConnectWithoutDepartmentInput[]
    createMany?: EmployeeCreateManyDepartmentInputEnvelope
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
  }

  export type TeamUncheckedCreateNestedManyWithoutDepartmentInput = {
    create?: XOR<TeamCreateWithoutDepartmentInput, TeamUncheckedCreateWithoutDepartmentInput> | TeamCreateWithoutDepartmentInput[] | TeamUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: TeamCreateOrConnectWithoutDepartmentInput | TeamCreateOrConnectWithoutDepartmentInput[]
    createMany?: TeamCreateManyDepartmentInputEnvelope
    connect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
  }

  export type EmployeeUncheckedCreateNestedManyWithoutDepartmentInput = {
    create?: XOR<EmployeeCreateWithoutDepartmentInput, EmployeeUncheckedCreateWithoutDepartmentInput> | EmployeeCreateWithoutDepartmentInput[] | EmployeeUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutDepartmentInput | EmployeeCreateOrConnectWithoutDepartmentInput[]
    createMany?: EmployeeCreateManyDepartmentInputEnvelope
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type BusinessUnitUpdateOneWithoutDepartmentsNestedInput = {
    create?: XOR<BusinessUnitCreateWithoutDepartmentsInput, BusinessUnitUncheckedCreateWithoutDepartmentsInput>
    connectOrCreate?: BusinessUnitCreateOrConnectWithoutDepartmentsInput
    upsert?: BusinessUnitUpsertWithoutDepartmentsInput
    disconnect?: BusinessUnitWhereInput | boolean
    delete?: BusinessUnitWhereInput | boolean
    connect?: BusinessUnitWhereUniqueInput
    update?: XOR<XOR<BusinessUnitUpdateToOneWithWhereWithoutDepartmentsInput, BusinessUnitUpdateWithoutDepartmentsInput>, BusinessUnitUncheckedUpdateWithoutDepartmentsInput>
  }

  export type TeamUpdateManyWithoutDepartmentNestedInput = {
    create?: XOR<TeamCreateWithoutDepartmentInput, TeamUncheckedCreateWithoutDepartmentInput> | TeamCreateWithoutDepartmentInput[] | TeamUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: TeamCreateOrConnectWithoutDepartmentInput | TeamCreateOrConnectWithoutDepartmentInput[]
    upsert?: TeamUpsertWithWhereUniqueWithoutDepartmentInput | TeamUpsertWithWhereUniqueWithoutDepartmentInput[]
    createMany?: TeamCreateManyDepartmentInputEnvelope
    set?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    disconnect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    delete?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    connect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    update?: TeamUpdateWithWhereUniqueWithoutDepartmentInput | TeamUpdateWithWhereUniqueWithoutDepartmentInput[]
    updateMany?: TeamUpdateManyWithWhereWithoutDepartmentInput | TeamUpdateManyWithWhereWithoutDepartmentInput[]
    deleteMany?: TeamScalarWhereInput | TeamScalarWhereInput[]
  }

  export type EmployeeUpdateManyWithoutDepartmentNestedInput = {
    create?: XOR<EmployeeCreateWithoutDepartmentInput, EmployeeUncheckedCreateWithoutDepartmentInput> | EmployeeCreateWithoutDepartmentInput[] | EmployeeUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutDepartmentInput | EmployeeCreateOrConnectWithoutDepartmentInput[]
    upsert?: EmployeeUpsertWithWhereUniqueWithoutDepartmentInput | EmployeeUpsertWithWhereUniqueWithoutDepartmentInput[]
    createMany?: EmployeeCreateManyDepartmentInputEnvelope
    set?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    disconnect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    delete?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    update?: EmployeeUpdateWithWhereUniqueWithoutDepartmentInput | EmployeeUpdateWithWhereUniqueWithoutDepartmentInput[]
    updateMany?: EmployeeUpdateManyWithWhereWithoutDepartmentInput | EmployeeUpdateManyWithWhereWithoutDepartmentInput[]
    deleteMany?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
  }

  export type TeamUncheckedUpdateManyWithoutDepartmentNestedInput = {
    create?: XOR<TeamCreateWithoutDepartmentInput, TeamUncheckedCreateWithoutDepartmentInput> | TeamCreateWithoutDepartmentInput[] | TeamUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: TeamCreateOrConnectWithoutDepartmentInput | TeamCreateOrConnectWithoutDepartmentInput[]
    upsert?: TeamUpsertWithWhereUniqueWithoutDepartmentInput | TeamUpsertWithWhereUniqueWithoutDepartmentInput[]
    createMany?: TeamCreateManyDepartmentInputEnvelope
    set?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    disconnect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    delete?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    connect?: TeamWhereUniqueInput | TeamWhereUniqueInput[]
    update?: TeamUpdateWithWhereUniqueWithoutDepartmentInput | TeamUpdateWithWhereUniqueWithoutDepartmentInput[]
    updateMany?: TeamUpdateManyWithWhereWithoutDepartmentInput | TeamUpdateManyWithWhereWithoutDepartmentInput[]
    deleteMany?: TeamScalarWhereInput | TeamScalarWhereInput[]
  }

  export type EmployeeUncheckedUpdateManyWithoutDepartmentNestedInput = {
    create?: XOR<EmployeeCreateWithoutDepartmentInput, EmployeeUncheckedCreateWithoutDepartmentInput> | EmployeeCreateWithoutDepartmentInput[] | EmployeeUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutDepartmentInput | EmployeeCreateOrConnectWithoutDepartmentInput[]
    upsert?: EmployeeUpsertWithWhereUniqueWithoutDepartmentInput | EmployeeUpsertWithWhereUniqueWithoutDepartmentInput[]
    createMany?: EmployeeCreateManyDepartmentInputEnvelope
    set?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    disconnect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    delete?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    update?: EmployeeUpdateWithWhereUniqueWithoutDepartmentInput | EmployeeUpdateWithWhereUniqueWithoutDepartmentInput[]
    updateMany?: EmployeeUpdateManyWithWhereWithoutDepartmentInput | EmployeeUpdateManyWithWhereWithoutDepartmentInput[]
    deleteMany?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
  }

  export type DepartmentCreateNestedOneWithoutTeamsInput = {
    create?: XOR<DepartmentCreateWithoutTeamsInput, DepartmentUncheckedCreateWithoutTeamsInput>
    connectOrCreate?: DepartmentCreateOrConnectWithoutTeamsInput
    connect?: DepartmentWhereUniqueInput
  }

  export type EmployeeCreateNestedManyWithoutTeamInput = {
    create?: XOR<EmployeeCreateWithoutTeamInput, EmployeeUncheckedCreateWithoutTeamInput> | EmployeeCreateWithoutTeamInput[] | EmployeeUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutTeamInput | EmployeeCreateOrConnectWithoutTeamInput[]
    createMany?: EmployeeCreateManyTeamInputEnvelope
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
  }

  export type EmployeeUncheckedCreateNestedManyWithoutTeamInput = {
    create?: XOR<EmployeeCreateWithoutTeamInput, EmployeeUncheckedCreateWithoutTeamInput> | EmployeeCreateWithoutTeamInput[] | EmployeeUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutTeamInput | EmployeeCreateOrConnectWithoutTeamInput[]
    createMany?: EmployeeCreateManyTeamInputEnvelope
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
  }

  export type DepartmentUpdateOneRequiredWithoutTeamsNestedInput = {
    create?: XOR<DepartmentCreateWithoutTeamsInput, DepartmentUncheckedCreateWithoutTeamsInput>
    connectOrCreate?: DepartmentCreateOrConnectWithoutTeamsInput
    upsert?: DepartmentUpsertWithoutTeamsInput
    connect?: DepartmentWhereUniqueInput
    update?: XOR<XOR<DepartmentUpdateToOneWithWhereWithoutTeamsInput, DepartmentUpdateWithoutTeamsInput>, DepartmentUncheckedUpdateWithoutTeamsInput>
  }

  export type EmployeeUpdateManyWithoutTeamNestedInput = {
    create?: XOR<EmployeeCreateWithoutTeamInput, EmployeeUncheckedCreateWithoutTeamInput> | EmployeeCreateWithoutTeamInput[] | EmployeeUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutTeamInput | EmployeeCreateOrConnectWithoutTeamInput[]
    upsert?: EmployeeUpsertWithWhereUniqueWithoutTeamInput | EmployeeUpsertWithWhereUniqueWithoutTeamInput[]
    createMany?: EmployeeCreateManyTeamInputEnvelope
    set?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    disconnect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    delete?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    update?: EmployeeUpdateWithWhereUniqueWithoutTeamInput | EmployeeUpdateWithWhereUniqueWithoutTeamInput[]
    updateMany?: EmployeeUpdateManyWithWhereWithoutTeamInput | EmployeeUpdateManyWithWhereWithoutTeamInput[]
    deleteMany?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
  }

  export type EmployeeUncheckedUpdateManyWithoutTeamNestedInput = {
    create?: XOR<EmployeeCreateWithoutTeamInput, EmployeeUncheckedCreateWithoutTeamInput> | EmployeeCreateWithoutTeamInput[] | EmployeeUncheckedCreateWithoutTeamInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutTeamInput | EmployeeCreateOrConnectWithoutTeamInput[]
    upsert?: EmployeeUpsertWithWhereUniqueWithoutTeamInput | EmployeeUpsertWithWhereUniqueWithoutTeamInput[]
    createMany?: EmployeeCreateManyTeamInputEnvelope
    set?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    disconnect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    delete?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    update?: EmployeeUpdateWithWhereUniqueWithoutTeamInput | EmployeeUpdateWithWhereUniqueWithoutTeamInput[]
    updateMany?: EmployeeUpdateManyWithWhereWithoutTeamInput | EmployeeUpdateManyWithWhereWithoutTeamInput[]
    deleteMany?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
  }

  export type EmployeeCreateNestedManyWithoutPositionInput = {
    create?: XOR<EmployeeCreateWithoutPositionInput, EmployeeUncheckedCreateWithoutPositionInput> | EmployeeCreateWithoutPositionInput[] | EmployeeUncheckedCreateWithoutPositionInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutPositionInput | EmployeeCreateOrConnectWithoutPositionInput[]
    createMany?: EmployeeCreateManyPositionInputEnvelope
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
  }

  export type EmployeeUncheckedCreateNestedManyWithoutPositionInput = {
    create?: XOR<EmployeeCreateWithoutPositionInput, EmployeeUncheckedCreateWithoutPositionInput> | EmployeeCreateWithoutPositionInput[] | EmployeeUncheckedCreateWithoutPositionInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutPositionInput | EmployeeCreateOrConnectWithoutPositionInput[]
    createMany?: EmployeeCreateManyPositionInputEnvelope
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
  }

  export type NullableEnumPositionLevelFieldUpdateOperationsInput = {
    set?: $Enums.PositionLevel | null
  }

  export type EmployeeUpdateManyWithoutPositionNestedInput = {
    create?: XOR<EmployeeCreateWithoutPositionInput, EmployeeUncheckedCreateWithoutPositionInput> | EmployeeCreateWithoutPositionInput[] | EmployeeUncheckedCreateWithoutPositionInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutPositionInput | EmployeeCreateOrConnectWithoutPositionInput[]
    upsert?: EmployeeUpsertWithWhereUniqueWithoutPositionInput | EmployeeUpsertWithWhereUniqueWithoutPositionInput[]
    createMany?: EmployeeCreateManyPositionInputEnvelope
    set?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    disconnect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    delete?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    update?: EmployeeUpdateWithWhereUniqueWithoutPositionInput | EmployeeUpdateWithWhereUniqueWithoutPositionInput[]
    updateMany?: EmployeeUpdateManyWithWhereWithoutPositionInput | EmployeeUpdateManyWithWhereWithoutPositionInput[]
    deleteMany?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
  }

  export type EmployeeUncheckedUpdateManyWithoutPositionNestedInput = {
    create?: XOR<EmployeeCreateWithoutPositionInput, EmployeeUncheckedCreateWithoutPositionInput> | EmployeeCreateWithoutPositionInput[] | EmployeeUncheckedCreateWithoutPositionInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutPositionInput | EmployeeCreateOrConnectWithoutPositionInput[]
    upsert?: EmployeeUpsertWithWhereUniqueWithoutPositionInput | EmployeeUpsertWithWhereUniqueWithoutPositionInput[]
    createMany?: EmployeeCreateManyPositionInputEnvelope
    set?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    disconnect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    delete?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    update?: EmployeeUpdateWithWhereUniqueWithoutPositionInput | EmployeeUpdateWithWhereUniqueWithoutPositionInput[]
    updateMany?: EmployeeUpdateManyWithWhereWithoutPositionInput | EmployeeUpdateManyWithWhereWithoutPositionInput[]
    deleteMany?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
  }

  export type PositionCreateNestedOneWithoutEmployeesInput = {
    create?: XOR<PositionCreateWithoutEmployeesInput, PositionUncheckedCreateWithoutEmployeesInput>
    connectOrCreate?: PositionCreateOrConnectWithoutEmployeesInput
    connect?: PositionWhereUniqueInput
  }

  export type DepartmentCreateNestedOneWithoutEmployeesInput = {
    create?: XOR<DepartmentCreateWithoutEmployeesInput, DepartmentUncheckedCreateWithoutEmployeesInput>
    connectOrCreate?: DepartmentCreateOrConnectWithoutEmployeesInput
    connect?: DepartmentWhereUniqueInput
  }

  export type TeamCreateNestedOneWithoutEmployeesInput = {
    create?: XOR<TeamCreateWithoutEmployeesInput, TeamUncheckedCreateWithoutEmployeesInput>
    connectOrCreate?: TeamCreateOrConnectWithoutEmployeesInput
    connect?: TeamWhereUniqueInput
  }

  export type EmployeeCreateNestedOneWithoutDirectReportsInput = {
    create?: XOR<EmployeeCreateWithoutDirectReportsInput, EmployeeUncheckedCreateWithoutDirectReportsInput>
    connectOrCreate?: EmployeeCreateOrConnectWithoutDirectReportsInput
    connect?: EmployeeWhereUniqueInput
  }

  export type EmployeeCreateNestedManyWithoutManagerInput = {
    create?: XOR<EmployeeCreateWithoutManagerInput, EmployeeUncheckedCreateWithoutManagerInput> | EmployeeCreateWithoutManagerInput[] | EmployeeUncheckedCreateWithoutManagerInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutManagerInput | EmployeeCreateOrConnectWithoutManagerInput[]
    createMany?: EmployeeCreateManyManagerInputEnvelope
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
  }

  export type SalaryHistoryCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<SalaryHistoryCreateWithoutEmployeeInput, SalaryHistoryUncheckedCreateWithoutEmployeeInput> | SalaryHistoryCreateWithoutEmployeeInput[] | SalaryHistoryUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: SalaryHistoryCreateOrConnectWithoutEmployeeInput | SalaryHistoryCreateOrConnectWithoutEmployeeInput[]
    createMany?: SalaryHistoryCreateManyEmployeeInputEnvelope
    connect?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
  }

  export type EmployeeUncheckedCreateNestedManyWithoutManagerInput = {
    create?: XOR<EmployeeCreateWithoutManagerInput, EmployeeUncheckedCreateWithoutManagerInput> | EmployeeCreateWithoutManagerInput[] | EmployeeUncheckedCreateWithoutManagerInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutManagerInput | EmployeeCreateOrConnectWithoutManagerInput[]
    createMany?: EmployeeCreateManyManagerInputEnvelope
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
  }

  export type SalaryHistoryUncheckedCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<SalaryHistoryCreateWithoutEmployeeInput, SalaryHistoryUncheckedCreateWithoutEmployeeInput> | SalaryHistoryCreateWithoutEmployeeInput[] | SalaryHistoryUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: SalaryHistoryCreateOrConnectWithoutEmployeeInput | SalaryHistoryCreateOrConnectWithoutEmployeeInput[]
    createMany?: SalaryHistoryCreateManyEmployeeInputEnvelope
    connect?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type EnumEmploymentStatusFieldUpdateOperationsInput = {
    set?: $Enums.EmploymentStatus
  }

  export type EnumContractTypeFieldUpdateOperationsInput = {
    set?: $Enums.ContractType
  }

  export type NullableDecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string | null
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type NullableEnumMaritalStatusFieldUpdateOperationsInput = {
    set?: $Enums.MaritalStatus | null
  }

  export type NullableEnumEducationLevelFieldUpdateOperationsInput = {
    set?: $Enums.EducationLevel | null
  }

  export type PositionUpdateOneWithoutEmployeesNestedInput = {
    create?: XOR<PositionCreateWithoutEmployeesInput, PositionUncheckedCreateWithoutEmployeesInput>
    connectOrCreate?: PositionCreateOrConnectWithoutEmployeesInput
    upsert?: PositionUpsertWithoutEmployeesInput
    disconnect?: PositionWhereInput | boolean
    delete?: PositionWhereInput | boolean
    connect?: PositionWhereUniqueInput
    update?: XOR<XOR<PositionUpdateToOneWithWhereWithoutEmployeesInput, PositionUpdateWithoutEmployeesInput>, PositionUncheckedUpdateWithoutEmployeesInput>
  }

  export type DepartmentUpdateOneWithoutEmployeesNestedInput = {
    create?: XOR<DepartmentCreateWithoutEmployeesInput, DepartmentUncheckedCreateWithoutEmployeesInput>
    connectOrCreate?: DepartmentCreateOrConnectWithoutEmployeesInput
    upsert?: DepartmentUpsertWithoutEmployeesInput
    disconnect?: DepartmentWhereInput | boolean
    delete?: DepartmentWhereInput | boolean
    connect?: DepartmentWhereUniqueInput
    update?: XOR<XOR<DepartmentUpdateToOneWithWhereWithoutEmployeesInput, DepartmentUpdateWithoutEmployeesInput>, DepartmentUncheckedUpdateWithoutEmployeesInput>
  }

  export type TeamUpdateOneWithoutEmployeesNestedInput = {
    create?: XOR<TeamCreateWithoutEmployeesInput, TeamUncheckedCreateWithoutEmployeesInput>
    connectOrCreate?: TeamCreateOrConnectWithoutEmployeesInput
    upsert?: TeamUpsertWithoutEmployeesInput
    disconnect?: TeamWhereInput | boolean
    delete?: TeamWhereInput | boolean
    connect?: TeamWhereUniqueInput
    update?: XOR<XOR<TeamUpdateToOneWithWhereWithoutEmployeesInput, TeamUpdateWithoutEmployeesInput>, TeamUncheckedUpdateWithoutEmployeesInput>
  }

  export type EmployeeUpdateOneWithoutDirectReportsNestedInput = {
    create?: XOR<EmployeeCreateWithoutDirectReportsInput, EmployeeUncheckedCreateWithoutDirectReportsInput>
    connectOrCreate?: EmployeeCreateOrConnectWithoutDirectReportsInput
    upsert?: EmployeeUpsertWithoutDirectReportsInput
    disconnect?: EmployeeWhereInput | boolean
    delete?: EmployeeWhereInput | boolean
    connect?: EmployeeWhereUniqueInput
    update?: XOR<XOR<EmployeeUpdateToOneWithWhereWithoutDirectReportsInput, EmployeeUpdateWithoutDirectReportsInput>, EmployeeUncheckedUpdateWithoutDirectReportsInput>
  }

  export type EmployeeUpdateManyWithoutManagerNestedInput = {
    create?: XOR<EmployeeCreateWithoutManagerInput, EmployeeUncheckedCreateWithoutManagerInput> | EmployeeCreateWithoutManagerInput[] | EmployeeUncheckedCreateWithoutManagerInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutManagerInput | EmployeeCreateOrConnectWithoutManagerInput[]
    upsert?: EmployeeUpsertWithWhereUniqueWithoutManagerInput | EmployeeUpsertWithWhereUniqueWithoutManagerInput[]
    createMany?: EmployeeCreateManyManagerInputEnvelope
    set?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    disconnect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    delete?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    update?: EmployeeUpdateWithWhereUniqueWithoutManagerInput | EmployeeUpdateWithWhereUniqueWithoutManagerInput[]
    updateMany?: EmployeeUpdateManyWithWhereWithoutManagerInput | EmployeeUpdateManyWithWhereWithoutManagerInput[]
    deleteMany?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
  }

  export type SalaryHistoryUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<SalaryHistoryCreateWithoutEmployeeInput, SalaryHistoryUncheckedCreateWithoutEmployeeInput> | SalaryHistoryCreateWithoutEmployeeInput[] | SalaryHistoryUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: SalaryHistoryCreateOrConnectWithoutEmployeeInput | SalaryHistoryCreateOrConnectWithoutEmployeeInput[]
    upsert?: SalaryHistoryUpsertWithWhereUniqueWithoutEmployeeInput | SalaryHistoryUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: SalaryHistoryCreateManyEmployeeInputEnvelope
    set?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
    disconnect?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
    delete?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
    connect?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
    update?: SalaryHistoryUpdateWithWhereUniqueWithoutEmployeeInput | SalaryHistoryUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: SalaryHistoryUpdateManyWithWhereWithoutEmployeeInput | SalaryHistoryUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: SalaryHistoryScalarWhereInput | SalaryHistoryScalarWhereInput[]
  }

  export type EmployeeUncheckedUpdateManyWithoutManagerNestedInput = {
    create?: XOR<EmployeeCreateWithoutManagerInput, EmployeeUncheckedCreateWithoutManagerInput> | EmployeeCreateWithoutManagerInput[] | EmployeeUncheckedCreateWithoutManagerInput[]
    connectOrCreate?: EmployeeCreateOrConnectWithoutManagerInput | EmployeeCreateOrConnectWithoutManagerInput[]
    upsert?: EmployeeUpsertWithWhereUniqueWithoutManagerInput | EmployeeUpsertWithWhereUniqueWithoutManagerInput[]
    createMany?: EmployeeCreateManyManagerInputEnvelope
    set?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    disconnect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    delete?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    connect?: EmployeeWhereUniqueInput | EmployeeWhereUniqueInput[]
    update?: EmployeeUpdateWithWhereUniqueWithoutManagerInput | EmployeeUpdateWithWhereUniqueWithoutManagerInput[]
    updateMany?: EmployeeUpdateManyWithWhereWithoutManagerInput | EmployeeUpdateManyWithWhereWithoutManagerInput[]
    deleteMany?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
  }

  export type SalaryHistoryUncheckedUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<SalaryHistoryCreateWithoutEmployeeInput, SalaryHistoryUncheckedCreateWithoutEmployeeInput> | SalaryHistoryCreateWithoutEmployeeInput[] | SalaryHistoryUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: SalaryHistoryCreateOrConnectWithoutEmployeeInput | SalaryHistoryCreateOrConnectWithoutEmployeeInput[]
    upsert?: SalaryHistoryUpsertWithWhereUniqueWithoutEmployeeInput | SalaryHistoryUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: SalaryHistoryCreateManyEmployeeInputEnvelope
    set?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
    disconnect?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
    delete?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
    connect?: SalaryHistoryWhereUniqueInput | SalaryHistoryWhereUniqueInput[]
    update?: SalaryHistoryUpdateWithWhereUniqueWithoutEmployeeInput | SalaryHistoryUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: SalaryHistoryUpdateManyWithWhereWithoutEmployeeInput | SalaryHistoryUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: SalaryHistoryScalarWhereInput | SalaryHistoryScalarWhereInput[]
  }

  export type EmployeeCreateNestedOneWithoutSalaryHistoryInput = {
    create?: XOR<EmployeeCreateWithoutSalaryHistoryInput, EmployeeUncheckedCreateWithoutSalaryHistoryInput>
    connectOrCreate?: EmployeeCreateOrConnectWithoutSalaryHistoryInput
    connect?: EmployeeWhereUniqueInput
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type NullableEnumSalaryChangeReasonFieldUpdateOperationsInput = {
    set?: $Enums.SalaryChangeReason | null
  }

  export type EmployeeUpdateOneRequiredWithoutSalaryHistoryNestedInput = {
    create?: XOR<EmployeeCreateWithoutSalaryHistoryInput, EmployeeUncheckedCreateWithoutSalaryHistoryInput>
    connectOrCreate?: EmployeeCreateOrConnectWithoutSalaryHistoryInput
    upsert?: EmployeeUpsertWithoutSalaryHistoryInput
    connect?: EmployeeWhereUniqueInput
    update?: XOR<XOR<EmployeeUpdateToOneWithWhereWithoutSalaryHistoryInput, EmployeeUpdateWithoutSalaryHistoryInput>, EmployeeUncheckedUpdateWithoutSalaryHistoryInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumPositionLevelNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.PositionLevel | EnumPositionLevelFieldRefInput<$PrismaModel> | null
    in?: $Enums.PositionLevel[] | ListEnumPositionLevelFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.PositionLevel[] | ListEnumPositionLevelFieldRefInput<$PrismaModel> | null
    not?: NestedEnumPositionLevelNullableFilter<$PrismaModel> | $Enums.PositionLevel | null
  }

  export type NestedEnumPositionLevelNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PositionLevel | EnumPositionLevelFieldRefInput<$PrismaModel> | null
    in?: $Enums.PositionLevel[] | ListEnumPositionLevelFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.PositionLevel[] | ListEnumPositionLevelFieldRefInput<$PrismaModel> | null
    not?: NestedEnumPositionLevelNullableWithAggregatesFilter<$PrismaModel> | $Enums.PositionLevel | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumPositionLevelNullableFilter<$PrismaModel>
    _max?: NestedEnumPositionLevelNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedEnumEmploymentStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.EmploymentStatus | EnumEmploymentStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EmploymentStatus[] | ListEnumEmploymentStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmploymentStatus[] | ListEnumEmploymentStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEmploymentStatusFilter<$PrismaModel> | $Enums.EmploymentStatus
  }

  export type NestedEnumContractTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.ContractType | EnumContractTypeFieldRefInput<$PrismaModel>
    in?: $Enums.ContractType[] | ListEnumContractTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.ContractType[] | ListEnumContractTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumContractTypeFilter<$PrismaModel> | $Enums.ContractType
  }

  export type NestedDecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type NestedEnumMaritalStatusNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.MaritalStatus | EnumMaritalStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumMaritalStatusNullableFilter<$PrismaModel> | $Enums.MaritalStatus | null
  }

  export type NestedEnumEducationLevelNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.EducationLevel | EnumEducationLevelFieldRefInput<$PrismaModel> | null
    in?: $Enums.EducationLevel[] | ListEnumEducationLevelFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.EducationLevel[] | ListEnumEducationLevelFieldRefInput<$PrismaModel> | null
    not?: NestedEnumEducationLevelNullableFilter<$PrismaModel> | $Enums.EducationLevel | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedEnumEmploymentStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EmploymentStatus | EnumEmploymentStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EmploymentStatus[] | ListEnumEmploymentStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EmploymentStatus[] | ListEnumEmploymentStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEmploymentStatusWithAggregatesFilter<$PrismaModel> | $Enums.EmploymentStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEmploymentStatusFilter<$PrismaModel>
    _max?: NestedEnumEmploymentStatusFilter<$PrismaModel>
  }

  export type NestedEnumContractTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ContractType | EnumContractTypeFieldRefInput<$PrismaModel>
    in?: $Enums.ContractType[] | ListEnumContractTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.ContractType[] | ListEnumContractTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumContractTypeWithAggregatesFilter<$PrismaModel> | $Enums.ContractType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumContractTypeFilter<$PrismaModel>
    _max?: NestedEnumContractTypeFilter<$PrismaModel>
  }

  export type NestedDecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type NestedEnumMaritalStatusNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.MaritalStatus | EnumMaritalStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.MaritalStatus[] | ListEnumMaritalStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumMaritalStatusNullableWithAggregatesFilter<$PrismaModel> | $Enums.MaritalStatus | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumMaritalStatusNullableFilter<$PrismaModel>
    _max?: NestedEnumMaritalStatusNullableFilter<$PrismaModel>
  }

  export type NestedEnumEducationLevelNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EducationLevel | EnumEducationLevelFieldRefInput<$PrismaModel> | null
    in?: $Enums.EducationLevel[] | ListEnumEducationLevelFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.EducationLevel[] | ListEnumEducationLevelFieldRefInput<$PrismaModel> | null
    not?: NestedEnumEducationLevelNullableWithAggregatesFilter<$PrismaModel> | $Enums.EducationLevel | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumEducationLevelNullableFilter<$PrismaModel>
    _max?: NestedEnumEducationLevelNullableFilter<$PrismaModel>
  }

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedEnumSalaryChangeReasonNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.SalaryChangeReason | EnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    in?: $Enums.SalaryChangeReason[] | ListEnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.SalaryChangeReason[] | ListEnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    not?: NestedEnumSalaryChangeReasonNullableFilter<$PrismaModel> | $Enums.SalaryChangeReason | null
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type NestedEnumSalaryChangeReasonNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SalaryChangeReason | EnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    in?: $Enums.SalaryChangeReason[] | ListEnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.SalaryChangeReason[] | ListEnumSalaryChangeReasonFieldRefInput<$PrismaModel> | null
    not?: NestedEnumSalaryChangeReasonNullableWithAggregatesFilter<$PrismaModel> | $Enums.SalaryChangeReason | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumSalaryChangeReasonNullableFilter<$PrismaModel>
    _max?: NestedEnumSalaryChangeReasonNullableFilter<$PrismaModel>
  }

  export type DepartmentCreateWithoutBusinessUnitInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    teams?: TeamCreateNestedManyWithoutDepartmentInput
    employees?: EmployeeCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentUncheckedCreateWithoutBusinessUnitInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    teams?: TeamUncheckedCreateNestedManyWithoutDepartmentInput
    employees?: EmployeeUncheckedCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentCreateOrConnectWithoutBusinessUnitInput = {
    where: DepartmentWhereUniqueInput
    create: XOR<DepartmentCreateWithoutBusinessUnitInput, DepartmentUncheckedCreateWithoutBusinessUnitInput>
  }

  export type DepartmentCreateManyBusinessUnitInputEnvelope = {
    data: DepartmentCreateManyBusinessUnitInput | DepartmentCreateManyBusinessUnitInput[]
    skipDuplicates?: boolean
  }

  export type DepartmentUpsertWithWhereUniqueWithoutBusinessUnitInput = {
    where: DepartmentWhereUniqueInput
    update: XOR<DepartmentUpdateWithoutBusinessUnitInput, DepartmentUncheckedUpdateWithoutBusinessUnitInput>
    create: XOR<DepartmentCreateWithoutBusinessUnitInput, DepartmentUncheckedCreateWithoutBusinessUnitInput>
  }

  export type DepartmentUpdateWithWhereUniqueWithoutBusinessUnitInput = {
    where: DepartmentWhereUniqueInput
    data: XOR<DepartmentUpdateWithoutBusinessUnitInput, DepartmentUncheckedUpdateWithoutBusinessUnitInput>
  }

  export type DepartmentUpdateManyWithWhereWithoutBusinessUnitInput = {
    where: DepartmentScalarWhereInput
    data: XOR<DepartmentUpdateManyMutationInput, DepartmentUncheckedUpdateManyWithoutBusinessUnitInput>
  }

  export type DepartmentScalarWhereInput = {
    AND?: DepartmentScalarWhereInput | DepartmentScalarWhereInput[]
    OR?: DepartmentScalarWhereInput[]
    NOT?: DepartmentScalarWhereInput | DepartmentScalarWhereInput[]
    id?: StringFilter<"Department"> | string
    name?: StringFilter<"Department"> | string
    code?: StringFilter<"Department"> | string
    description?: StringNullableFilter<"Department"> | string | null
    headId?: StringNullableFilter<"Department"> | string | null
    businessUnitId?: StringNullableFilter<"Department"> | string | null
    isActive?: BoolFilter<"Department"> | boolean
    createdAt?: DateTimeFilter<"Department"> | Date | string
    updatedAt?: DateTimeFilter<"Department"> | Date | string
  }

  export type BusinessUnitCreateWithoutDepartmentsInput = {
    id?: string
    name: string
    address: string
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BusinessUnitUncheckedCreateWithoutDepartmentsInput = {
    id?: string
    name: string
    address: string
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BusinessUnitCreateOrConnectWithoutDepartmentsInput = {
    where: BusinessUnitWhereUniqueInput
    create: XOR<BusinessUnitCreateWithoutDepartmentsInput, BusinessUnitUncheckedCreateWithoutDepartmentsInput>
  }

  export type TeamCreateWithoutDepartmentInput = {
    id?: string
    name: string
    code?: string | null
    description?: string | null
    leadId?: string | null
    projectFocus?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    employees?: EmployeeCreateNestedManyWithoutTeamInput
  }

  export type TeamUncheckedCreateWithoutDepartmentInput = {
    id?: string
    name: string
    code?: string | null
    description?: string | null
    leadId?: string | null
    projectFocus?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    employees?: EmployeeUncheckedCreateNestedManyWithoutTeamInput
  }

  export type TeamCreateOrConnectWithoutDepartmentInput = {
    where: TeamWhereUniqueInput
    create: XOR<TeamCreateWithoutDepartmentInput, TeamUncheckedCreateWithoutDepartmentInput>
  }

  export type TeamCreateManyDepartmentInputEnvelope = {
    data: TeamCreateManyDepartmentInput | TeamCreateManyDepartmentInput[]
    skipDuplicates?: boolean
  }

  export type EmployeeCreateWithoutDepartmentInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    position?: PositionCreateNestedOneWithoutEmployeesInput
    team?: TeamCreateNestedOneWithoutEmployeesInput
    manager?: EmployeeCreateNestedOneWithoutDirectReportsInput
    directReports?: EmployeeCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUncheckedCreateWithoutDepartmentInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    teamId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    directReports?: EmployeeUncheckedCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeCreateOrConnectWithoutDepartmentInput = {
    where: EmployeeWhereUniqueInput
    create: XOR<EmployeeCreateWithoutDepartmentInput, EmployeeUncheckedCreateWithoutDepartmentInput>
  }

  export type EmployeeCreateManyDepartmentInputEnvelope = {
    data: EmployeeCreateManyDepartmentInput | EmployeeCreateManyDepartmentInput[]
    skipDuplicates?: boolean
  }

  export type BusinessUnitUpsertWithoutDepartmentsInput = {
    update: XOR<BusinessUnitUpdateWithoutDepartmentsInput, BusinessUnitUncheckedUpdateWithoutDepartmentsInput>
    create: XOR<BusinessUnitCreateWithoutDepartmentsInput, BusinessUnitUncheckedCreateWithoutDepartmentsInput>
    where?: BusinessUnitWhereInput
  }

  export type BusinessUnitUpdateToOneWithWhereWithoutDepartmentsInput = {
    where?: BusinessUnitWhereInput
    data: XOR<BusinessUnitUpdateWithoutDepartmentsInput, BusinessUnitUncheckedUpdateWithoutDepartmentsInput>
  }

  export type BusinessUnitUpdateWithoutDepartmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BusinessUnitUncheckedUpdateWithoutDepartmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamUpsertWithWhereUniqueWithoutDepartmentInput = {
    where: TeamWhereUniqueInput
    update: XOR<TeamUpdateWithoutDepartmentInput, TeamUncheckedUpdateWithoutDepartmentInput>
    create: XOR<TeamCreateWithoutDepartmentInput, TeamUncheckedCreateWithoutDepartmentInput>
  }

  export type TeamUpdateWithWhereUniqueWithoutDepartmentInput = {
    where: TeamWhereUniqueInput
    data: XOR<TeamUpdateWithoutDepartmentInput, TeamUncheckedUpdateWithoutDepartmentInput>
  }

  export type TeamUpdateManyWithWhereWithoutDepartmentInput = {
    where: TeamScalarWhereInput
    data: XOR<TeamUpdateManyMutationInput, TeamUncheckedUpdateManyWithoutDepartmentInput>
  }

  export type TeamScalarWhereInput = {
    AND?: TeamScalarWhereInput | TeamScalarWhereInput[]
    OR?: TeamScalarWhereInput[]
    NOT?: TeamScalarWhereInput | TeamScalarWhereInput[]
    id?: StringFilter<"Team"> | string
    name?: StringFilter<"Team"> | string
    code?: StringNullableFilter<"Team"> | string | null
    description?: StringNullableFilter<"Team"> | string | null
    departmentId?: StringFilter<"Team"> | string
    leadId?: StringNullableFilter<"Team"> | string | null
    projectFocus?: StringNullableFilter<"Team"> | string | null
    isActive?: BoolFilter<"Team"> | boolean
    createdAt?: DateTimeFilter<"Team"> | Date | string
    updatedAt?: DateTimeFilter<"Team"> | Date | string
  }

  export type EmployeeUpsertWithWhereUniqueWithoutDepartmentInput = {
    where: EmployeeWhereUniqueInput
    update: XOR<EmployeeUpdateWithoutDepartmentInput, EmployeeUncheckedUpdateWithoutDepartmentInput>
    create: XOR<EmployeeCreateWithoutDepartmentInput, EmployeeUncheckedCreateWithoutDepartmentInput>
  }

  export type EmployeeUpdateWithWhereUniqueWithoutDepartmentInput = {
    where: EmployeeWhereUniqueInput
    data: XOR<EmployeeUpdateWithoutDepartmentInput, EmployeeUncheckedUpdateWithoutDepartmentInput>
  }

  export type EmployeeUpdateManyWithWhereWithoutDepartmentInput = {
    where: EmployeeScalarWhereInput
    data: XOR<EmployeeUpdateManyMutationInput, EmployeeUncheckedUpdateManyWithoutDepartmentInput>
  }

  export type EmployeeScalarWhereInput = {
    AND?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
    OR?: EmployeeScalarWhereInput[]
    NOT?: EmployeeScalarWhereInput | EmployeeScalarWhereInput[]
    id?: StringFilter<"Employee"> | string
    employeeCode?: StringFilter<"Employee"> | string
    firstName?: StringFilter<"Employee"> | string
    lastName?: StringFilter<"Employee"> | string
    email?: StringFilter<"Employee"> | string
    phone?: StringNullableFilter<"Employee"> | string | null
    dateOfBirth?: DateTimeNullableFilter<"Employee"> | Date | string | null
    hireDate?: DateTimeFilter<"Employee"> | Date | string
    employmentStatus?: EnumEmploymentStatusFilter<"Employee"> | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFilter<"Employee"> | $Enums.ContractType
    grossSalary?: DecimalNullableFilter<"Employee"> | Decimal | DecimalJsLike | number | string | null
    netSalary?: DecimalNullableFilter<"Employee"> | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: EnumMaritalStatusNullableFilter<"Employee"> | $Enums.MaritalStatus | null
    educationLevel?: EnumEducationLevelNullableFilter<"Employee"> | $Enums.EducationLevel | null
    educationField?: StringNullableFilter<"Employee"> | string | null
    positionId?: StringNullableFilter<"Employee"> | string | null
    departmentId?: StringNullableFilter<"Employee"> | string | null
    teamId?: StringNullableFilter<"Employee"> | string | null
    managerId?: StringNullableFilter<"Employee"> | string | null
    createdAt?: DateTimeFilter<"Employee"> | Date | string
    updatedAt?: DateTimeFilter<"Employee"> | Date | string
  }

  export type DepartmentCreateWithoutTeamsInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    businessUnit?: BusinessUnitCreateNestedOneWithoutDepartmentsInput
    employees?: EmployeeCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentUncheckedCreateWithoutTeamsInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    businessUnitId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    employees?: EmployeeUncheckedCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentCreateOrConnectWithoutTeamsInput = {
    where: DepartmentWhereUniqueInput
    create: XOR<DepartmentCreateWithoutTeamsInput, DepartmentUncheckedCreateWithoutTeamsInput>
  }

  export type EmployeeCreateWithoutTeamInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    position?: PositionCreateNestedOneWithoutEmployeesInput
    department?: DepartmentCreateNestedOneWithoutEmployeesInput
    manager?: EmployeeCreateNestedOneWithoutDirectReportsInput
    directReports?: EmployeeCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUncheckedCreateWithoutTeamInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    departmentId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    directReports?: EmployeeUncheckedCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeCreateOrConnectWithoutTeamInput = {
    where: EmployeeWhereUniqueInput
    create: XOR<EmployeeCreateWithoutTeamInput, EmployeeUncheckedCreateWithoutTeamInput>
  }

  export type EmployeeCreateManyTeamInputEnvelope = {
    data: EmployeeCreateManyTeamInput | EmployeeCreateManyTeamInput[]
    skipDuplicates?: boolean
  }

  export type DepartmentUpsertWithoutTeamsInput = {
    update: XOR<DepartmentUpdateWithoutTeamsInput, DepartmentUncheckedUpdateWithoutTeamsInput>
    create: XOR<DepartmentCreateWithoutTeamsInput, DepartmentUncheckedCreateWithoutTeamsInput>
    where?: DepartmentWhereInput
  }

  export type DepartmentUpdateToOneWithWhereWithoutTeamsInput = {
    where?: DepartmentWhereInput
    data: XOR<DepartmentUpdateWithoutTeamsInput, DepartmentUncheckedUpdateWithoutTeamsInput>
  }

  export type DepartmentUpdateWithoutTeamsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    businessUnit?: BusinessUnitUpdateOneWithoutDepartmentsNestedInput
    employees?: EmployeeUpdateManyWithoutDepartmentNestedInput
  }

  export type DepartmentUncheckedUpdateWithoutTeamsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    businessUnitId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employees?: EmployeeUncheckedUpdateManyWithoutDepartmentNestedInput
  }

  export type EmployeeUpsertWithWhereUniqueWithoutTeamInput = {
    where: EmployeeWhereUniqueInput
    update: XOR<EmployeeUpdateWithoutTeamInput, EmployeeUncheckedUpdateWithoutTeamInput>
    create: XOR<EmployeeCreateWithoutTeamInput, EmployeeUncheckedCreateWithoutTeamInput>
  }

  export type EmployeeUpdateWithWhereUniqueWithoutTeamInput = {
    where: EmployeeWhereUniqueInput
    data: XOR<EmployeeUpdateWithoutTeamInput, EmployeeUncheckedUpdateWithoutTeamInput>
  }

  export type EmployeeUpdateManyWithWhereWithoutTeamInput = {
    where: EmployeeScalarWhereInput
    data: XOR<EmployeeUpdateManyMutationInput, EmployeeUncheckedUpdateManyWithoutTeamInput>
  }

  export type EmployeeCreateWithoutPositionInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    department?: DepartmentCreateNestedOneWithoutEmployeesInput
    team?: TeamCreateNestedOneWithoutEmployeesInput
    manager?: EmployeeCreateNestedOneWithoutDirectReportsInput
    directReports?: EmployeeCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUncheckedCreateWithoutPositionInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    departmentId?: string | null
    teamId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    directReports?: EmployeeUncheckedCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeCreateOrConnectWithoutPositionInput = {
    where: EmployeeWhereUniqueInput
    create: XOR<EmployeeCreateWithoutPositionInput, EmployeeUncheckedCreateWithoutPositionInput>
  }

  export type EmployeeCreateManyPositionInputEnvelope = {
    data: EmployeeCreateManyPositionInput | EmployeeCreateManyPositionInput[]
    skipDuplicates?: boolean
  }

  export type EmployeeUpsertWithWhereUniqueWithoutPositionInput = {
    where: EmployeeWhereUniqueInput
    update: XOR<EmployeeUpdateWithoutPositionInput, EmployeeUncheckedUpdateWithoutPositionInput>
    create: XOR<EmployeeCreateWithoutPositionInput, EmployeeUncheckedCreateWithoutPositionInput>
  }

  export type EmployeeUpdateWithWhereUniqueWithoutPositionInput = {
    where: EmployeeWhereUniqueInput
    data: XOR<EmployeeUpdateWithoutPositionInput, EmployeeUncheckedUpdateWithoutPositionInput>
  }

  export type EmployeeUpdateManyWithWhereWithoutPositionInput = {
    where: EmployeeScalarWhereInput
    data: XOR<EmployeeUpdateManyMutationInput, EmployeeUncheckedUpdateManyWithoutPositionInput>
  }

  export type PositionCreateWithoutEmployeesInput = {
    id?: string
    title: string
    level?: $Enums.PositionLevel | null
    isActive?: boolean
    createdAt?: Date | string
  }

  export type PositionUncheckedCreateWithoutEmployeesInput = {
    id?: string
    title: string
    level?: $Enums.PositionLevel | null
    isActive?: boolean
    createdAt?: Date | string
  }

  export type PositionCreateOrConnectWithoutEmployeesInput = {
    where: PositionWhereUniqueInput
    create: XOR<PositionCreateWithoutEmployeesInput, PositionUncheckedCreateWithoutEmployeesInput>
  }

  export type DepartmentCreateWithoutEmployeesInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    businessUnit?: BusinessUnitCreateNestedOneWithoutDepartmentsInput
    teams?: TeamCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentUncheckedCreateWithoutEmployeesInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    businessUnitId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    teams?: TeamUncheckedCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentCreateOrConnectWithoutEmployeesInput = {
    where: DepartmentWhereUniqueInput
    create: XOR<DepartmentCreateWithoutEmployeesInput, DepartmentUncheckedCreateWithoutEmployeesInput>
  }

  export type TeamCreateWithoutEmployeesInput = {
    id?: string
    name: string
    code?: string | null
    description?: string | null
    leadId?: string | null
    projectFocus?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    department: DepartmentCreateNestedOneWithoutTeamsInput
  }

  export type TeamUncheckedCreateWithoutEmployeesInput = {
    id?: string
    name: string
    code?: string | null
    description?: string | null
    departmentId: string
    leadId?: string | null
    projectFocus?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TeamCreateOrConnectWithoutEmployeesInput = {
    where: TeamWhereUniqueInput
    create: XOR<TeamCreateWithoutEmployeesInput, TeamUncheckedCreateWithoutEmployeesInput>
  }

  export type EmployeeCreateWithoutDirectReportsInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    position?: PositionCreateNestedOneWithoutEmployeesInput
    department?: DepartmentCreateNestedOneWithoutEmployeesInput
    team?: TeamCreateNestedOneWithoutEmployeesInput
    manager?: EmployeeCreateNestedOneWithoutDirectReportsInput
    salaryHistory?: SalaryHistoryCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUncheckedCreateWithoutDirectReportsInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    departmentId?: string | null
    teamId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    salaryHistory?: SalaryHistoryUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeCreateOrConnectWithoutDirectReportsInput = {
    where: EmployeeWhereUniqueInput
    create: XOR<EmployeeCreateWithoutDirectReportsInput, EmployeeUncheckedCreateWithoutDirectReportsInput>
  }

  export type EmployeeCreateWithoutManagerInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    position?: PositionCreateNestedOneWithoutEmployeesInput
    department?: DepartmentCreateNestedOneWithoutEmployeesInput
    team?: TeamCreateNestedOneWithoutEmployeesInput
    directReports?: EmployeeCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeUncheckedCreateWithoutManagerInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    departmentId?: string | null
    teamId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    directReports?: EmployeeUncheckedCreateNestedManyWithoutManagerInput
    salaryHistory?: SalaryHistoryUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type EmployeeCreateOrConnectWithoutManagerInput = {
    where: EmployeeWhereUniqueInput
    create: XOR<EmployeeCreateWithoutManagerInput, EmployeeUncheckedCreateWithoutManagerInput>
  }

  export type EmployeeCreateManyManagerInputEnvelope = {
    data: EmployeeCreateManyManagerInput | EmployeeCreateManyManagerInput[]
    skipDuplicates?: boolean
  }

  export type SalaryHistoryCreateWithoutEmployeeInput = {
    id?: string
    previousGrossSalary: Decimal | DecimalJsLike | number | string
    newGrossSalary: Decimal | DecimalJsLike | number | string
    previousNetSalary?: Decimal | DecimalJsLike | number | string | null
    newNetSalary?: Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    effectiveDate: Date | string
    reason?: $Enums.SalaryChangeReason | null
    reasonComment?: string | null
    changedById: string
    createdAt?: Date | string
  }

  export type SalaryHistoryUncheckedCreateWithoutEmployeeInput = {
    id?: string
    previousGrossSalary: Decimal | DecimalJsLike | number | string
    newGrossSalary: Decimal | DecimalJsLike | number | string
    previousNetSalary?: Decimal | DecimalJsLike | number | string | null
    newNetSalary?: Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    effectiveDate: Date | string
    reason?: $Enums.SalaryChangeReason | null
    reasonComment?: string | null
    changedById: string
    createdAt?: Date | string
  }

  export type SalaryHistoryCreateOrConnectWithoutEmployeeInput = {
    where: SalaryHistoryWhereUniqueInput
    create: XOR<SalaryHistoryCreateWithoutEmployeeInput, SalaryHistoryUncheckedCreateWithoutEmployeeInput>
  }

  export type SalaryHistoryCreateManyEmployeeInputEnvelope = {
    data: SalaryHistoryCreateManyEmployeeInput | SalaryHistoryCreateManyEmployeeInput[]
    skipDuplicates?: boolean
  }

  export type PositionUpsertWithoutEmployeesInput = {
    update: XOR<PositionUpdateWithoutEmployeesInput, PositionUncheckedUpdateWithoutEmployeesInput>
    create: XOR<PositionCreateWithoutEmployeesInput, PositionUncheckedCreateWithoutEmployeesInput>
    where?: PositionWhereInput
  }

  export type PositionUpdateToOneWithWhereWithoutEmployeesInput = {
    where?: PositionWhereInput
    data: XOR<PositionUpdateWithoutEmployeesInput, PositionUncheckedUpdateWithoutEmployeesInput>
  }

  export type PositionUpdateWithoutEmployeesInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    level?: NullableEnumPositionLevelFieldUpdateOperationsInput | $Enums.PositionLevel | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PositionUncheckedUpdateWithoutEmployeesInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    level?: NullableEnumPositionLevelFieldUpdateOperationsInput | $Enums.PositionLevel | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DepartmentUpsertWithoutEmployeesInput = {
    update: XOR<DepartmentUpdateWithoutEmployeesInput, DepartmentUncheckedUpdateWithoutEmployeesInput>
    create: XOR<DepartmentCreateWithoutEmployeesInput, DepartmentUncheckedCreateWithoutEmployeesInput>
    where?: DepartmentWhereInput
  }

  export type DepartmentUpdateToOneWithWhereWithoutEmployeesInput = {
    where?: DepartmentWhereInput
    data: XOR<DepartmentUpdateWithoutEmployeesInput, DepartmentUncheckedUpdateWithoutEmployeesInput>
  }

  export type DepartmentUpdateWithoutEmployeesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    businessUnit?: BusinessUnitUpdateOneWithoutDepartmentsNestedInput
    teams?: TeamUpdateManyWithoutDepartmentNestedInput
  }

  export type DepartmentUncheckedUpdateWithoutEmployeesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    businessUnitId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    teams?: TeamUncheckedUpdateManyWithoutDepartmentNestedInput
  }

  export type TeamUpsertWithoutEmployeesInput = {
    update: XOR<TeamUpdateWithoutEmployeesInput, TeamUncheckedUpdateWithoutEmployeesInput>
    create: XOR<TeamCreateWithoutEmployeesInput, TeamUncheckedCreateWithoutEmployeesInput>
    where?: TeamWhereInput
  }

  export type TeamUpdateToOneWithWhereWithoutEmployeesInput = {
    where?: TeamWhereInput
    data: XOR<TeamUpdateWithoutEmployeesInput, TeamUncheckedUpdateWithoutEmployeesInput>
  }

  export type TeamUpdateWithoutEmployeesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    leadId?: NullableStringFieldUpdateOperationsInput | string | null
    projectFocus?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    department?: DepartmentUpdateOneRequiredWithoutTeamsNestedInput
  }

  export type TeamUncheckedUpdateWithoutEmployeesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: StringFieldUpdateOperationsInput | string
    leadId?: NullableStringFieldUpdateOperationsInput | string | null
    projectFocus?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmployeeUpsertWithoutDirectReportsInput = {
    update: XOR<EmployeeUpdateWithoutDirectReportsInput, EmployeeUncheckedUpdateWithoutDirectReportsInput>
    create: XOR<EmployeeCreateWithoutDirectReportsInput, EmployeeUncheckedCreateWithoutDirectReportsInput>
    where?: EmployeeWhereInput
  }

  export type EmployeeUpdateToOneWithWhereWithoutDirectReportsInput = {
    where?: EmployeeWhereInput
    data: XOR<EmployeeUpdateWithoutDirectReportsInput, EmployeeUncheckedUpdateWithoutDirectReportsInput>
  }

  export type EmployeeUpdateWithoutDirectReportsInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    position?: PositionUpdateOneWithoutEmployeesNestedInput
    department?: DepartmentUpdateOneWithoutEmployeesNestedInput
    team?: TeamUpdateOneWithoutEmployeesNestedInput
    manager?: EmployeeUpdateOneWithoutDirectReportsNestedInput
    salaryHistory?: SalaryHistoryUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateWithoutDirectReportsInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    salaryHistory?: SalaryHistoryUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUpsertWithWhereUniqueWithoutManagerInput = {
    where: EmployeeWhereUniqueInput
    update: XOR<EmployeeUpdateWithoutManagerInput, EmployeeUncheckedUpdateWithoutManagerInput>
    create: XOR<EmployeeCreateWithoutManagerInput, EmployeeUncheckedCreateWithoutManagerInput>
  }

  export type EmployeeUpdateWithWhereUniqueWithoutManagerInput = {
    where: EmployeeWhereUniqueInput
    data: XOR<EmployeeUpdateWithoutManagerInput, EmployeeUncheckedUpdateWithoutManagerInput>
  }

  export type EmployeeUpdateManyWithWhereWithoutManagerInput = {
    where: EmployeeScalarWhereInput
    data: XOR<EmployeeUpdateManyMutationInput, EmployeeUncheckedUpdateManyWithoutManagerInput>
  }

  export type SalaryHistoryUpsertWithWhereUniqueWithoutEmployeeInput = {
    where: SalaryHistoryWhereUniqueInput
    update: XOR<SalaryHistoryUpdateWithoutEmployeeInput, SalaryHistoryUncheckedUpdateWithoutEmployeeInput>
    create: XOR<SalaryHistoryCreateWithoutEmployeeInput, SalaryHistoryUncheckedCreateWithoutEmployeeInput>
  }

  export type SalaryHistoryUpdateWithWhereUniqueWithoutEmployeeInput = {
    where: SalaryHistoryWhereUniqueInput
    data: XOR<SalaryHistoryUpdateWithoutEmployeeInput, SalaryHistoryUncheckedUpdateWithoutEmployeeInput>
  }

  export type SalaryHistoryUpdateManyWithWhereWithoutEmployeeInput = {
    where: SalaryHistoryScalarWhereInput
    data: XOR<SalaryHistoryUpdateManyMutationInput, SalaryHistoryUncheckedUpdateManyWithoutEmployeeInput>
  }

  export type SalaryHistoryScalarWhereInput = {
    AND?: SalaryHistoryScalarWhereInput | SalaryHistoryScalarWhereInput[]
    OR?: SalaryHistoryScalarWhereInput[]
    NOT?: SalaryHistoryScalarWhereInput | SalaryHistoryScalarWhereInput[]
    id?: StringFilter<"SalaryHistory"> | string
    employeeId?: StringFilter<"SalaryHistory"> | string
    previousGrossSalary?: DecimalFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string
    previousNetSalary?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: DecimalNullableFilter<"SalaryHistory"> | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFilter<"SalaryHistory"> | Date | string
    reason?: EnumSalaryChangeReasonNullableFilter<"SalaryHistory"> | $Enums.SalaryChangeReason | null
    reasonComment?: StringNullableFilter<"SalaryHistory"> | string | null
    changedById?: StringFilter<"SalaryHistory"> | string
    createdAt?: DateTimeFilter<"SalaryHistory"> | Date | string
  }

  export type EmployeeCreateWithoutSalaryHistoryInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    position?: PositionCreateNestedOneWithoutEmployeesInput
    department?: DepartmentCreateNestedOneWithoutEmployeesInput
    team?: TeamCreateNestedOneWithoutEmployeesInput
    manager?: EmployeeCreateNestedOneWithoutDirectReportsInput
    directReports?: EmployeeCreateNestedManyWithoutManagerInput
  }

  export type EmployeeUncheckedCreateWithoutSalaryHistoryInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    departmentId?: string | null
    teamId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    directReports?: EmployeeUncheckedCreateNestedManyWithoutManagerInput
  }

  export type EmployeeCreateOrConnectWithoutSalaryHistoryInput = {
    where: EmployeeWhereUniqueInput
    create: XOR<EmployeeCreateWithoutSalaryHistoryInput, EmployeeUncheckedCreateWithoutSalaryHistoryInput>
  }

  export type EmployeeUpsertWithoutSalaryHistoryInput = {
    update: XOR<EmployeeUpdateWithoutSalaryHistoryInput, EmployeeUncheckedUpdateWithoutSalaryHistoryInput>
    create: XOR<EmployeeCreateWithoutSalaryHistoryInput, EmployeeUncheckedCreateWithoutSalaryHistoryInput>
    where?: EmployeeWhereInput
  }

  export type EmployeeUpdateToOneWithWhereWithoutSalaryHistoryInput = {
    where?: EmployeeWhereInput
    data: XOR<EmployeeUpdateWithoutSalaryHistoryInput, EmployeeUncheckedUpdateWithoutSalaryHistoryInput>
  }

  export type EmployeeUpdateWithoutSalaryHistoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    position?: PositionUpdateOneWithoutEmployeesNestedInput
    department?: DepartmentUpdateOneWithoutEmployeesNestedInput
    team?: TeamUpdateOneWithoutEmployeesNestedInput
    manager?: EmployeeUpdateOneWithoutDirectReportsNestedInput
    directReports?: EmployeeUpdateManyWithoutManagerNestedInput
  }

  export type EmployeeUncheckedUpdateWithoutSalaryHistoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    directReports?: EmployeeUncheckedUpdateManyWithoutManagerNestedInput
  }

  export type DepartmentCreateManyBusinessUnitInput = {
    id?: string
    name: string
    code: string
    description?: string | null
    headId?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DepartmentUpdateWithoutBusinessUnitInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    teams?: TeamUpdateManyWithoutDepartmentNestedInput
    employees?: EmployeeUpdateManyWithoutDepartmentNestedInput
  }

  export type DepartmentUncheckedUpdateWithoutBusinessUnitInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    teams?: TeamUncheckedUpdateManyWithoutDepartmentNestedInput
    employees?: EmployeeUncheckedUpdateManyWithoutDepartmentNestedInput
  }

  export type DepartmentUncheckedUpdateManyWithoutBusinessUnitInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    headId?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TeamCreateManyDepartmentInput = {
    id?: string
    name: string
    code?: string | null
    description?: string | null
    leadId?: string | null
    projectFocus?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type EmployeeCreateManyDepartmentInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    teamId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TeamUpdateWithoutDepartmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    leadId?: NullableStringFieldUpdateOperationsInput | string | null
    projectFocus?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employees?: EmployeeUpdateManyWithoutTeamNestedInput
  }

  export type TeamUncheckedUpdateWithoutDepartmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    leadId?: NullableStringFieldUpdateOperationsInput | string | null
    projectFocus?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    employees?: EmployeeUncheckedUpdateManyWithoutTeamNestedInput
  }

  export type TeamUncheckedUpdateManyWithoutDepartmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    leadId?: NullableStringFieldUpdateOperationsInput | string | null
    projectFocus?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmployeeUpdateWithoutDepartmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    position?: PositionUpdateOneWithoutEmployeesNestedInput
    team?: TeamUpdateOneWithoutEmployeesNestedInput
    manager?: EmployeeUpdateOneWithoutDirectReportsNestedInput
    directReports?: EmployeeUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateWithoutDepartmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    directReports?: EmployeeUncheckedUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateManyWithoutDepartmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmployeeCreateManyTeamInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    departmentId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type EmployeeUpdateWithoutTeamInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    position?: PositionUpdateOneWithoutEmployeesNestedInput
    department?: DepartmentUpdateOneWithoutEmployeesNestedInput
    manager?: EmployeeUpdateOneWithoutDirectReportsNestedInput
    directReports?: EmployeeUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateWithoutTeamInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    directReports?: EmployeeUncheckedUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateManyWithoutTeamInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmployeeCreateManyPositionInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    departmentId?: string | null
    teamId?: string | null
    managerId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type EmployeeUpdateWithoutPositionInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    department?: DepartmentUpdateOneWithoutEmployeesNestedInput
    team?: TeamUpdateOneWithoutEmployeesNestedInput
    manager?: EmployeeUpdateOneWithoutDirectReportsNestedInput
    directReports?: EmployeeUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateWithoutPositionInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    directReports?: EmployeeUncheckedUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateManyWithoutPositionInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    managerId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EmployeeCreateManyManagerInput = {
    id?: string
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    dateOfBirth?: Date | string | null
    hireDate: Date | string
    employmentStatus?: $Enums.EmploymentStatus
    contractType?: $Enums.ContractType
    grossSalary?: Decimal | DecimalJsLike | number | string | null
    netSalary?: Decimal | DecimalJsLike | number | string | null
    maritalStatus?: $Enums.MaritalStatus | null
    educationLevel?: $Enums.EducationLevel | null
    educationField?: string | null
    positionId?: string | null
    departmentId?: string | null
    teamId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SalaryHistoryCreateManyEmployeeInput = {
    id?: string
    previousGrossSalary: Decimal | DecimalJsLike | number | string
    newGrossSalary: Decimal | DecimalJsLike | number | string
    previousNetSalary?: Decimal | DecimalJsLike | number | string | null
    newNetSalary?: Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: Decimal | DecimalJsLike | number | string | null
    effectiveDate: Date | string
    reason?: $Enums.SalaryChangeReason | null
    reasonComment?: string | null
    changedById: string
    createdAt?: Date | string
  }

  export type EmployeeUpdateWithoutManagerInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    position?: PositionUpdateOneWithoutEmployeesNestedInput
    department?: DepartmentUpdateOneWithoutEmployeesNestedInput
    team?: TeamUpdateOneWithoutEmployeesNestedInput
    directReports?: EmployeeUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateWithoutManagerInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    directReports?: EmployeeUncheckedUpdateManyWithoutManagerNestedInput
    salaryHistory?: SalaryHistoryUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type EmployeeUncheckedUpdateManyWithoutManagerInput = {
    id?: StringFieldUpdateOperationsInput | string
    employeeCode?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    dateOfBirth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hireDate?: DateTimeFieldUpdateOperationsInput | Date | string
    employmentStatus?: EnumEmploymentStatusFieldUpdateOperationsInput | $Enums.EmploymentStatus
    contractType?: EnumContractTypeFieldUpdateOperationsInput | $Enums.ContractType
    grossSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maritalStatus?: NullableEnumMaritalStatusFieldUpdateOperationsInput | $Enums.MaritalStatus | null
    educationLevel?: NullableEnumEducationLevelFieldUpdateOperationsInput | $Enums.EducationLevel | null
    educationField?: NullableStringFieldUpdateOperationsInput | string | null
    positionId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    teamId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SalaryHistoryUpdateWithoutEmployeeInput = {
    id?: StringFieldUpdateOperationsInput | string
    previousGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    previousNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableEnumSalaryChangeReasonFieldUpdateOperationsInput | $Enums.SalaryChangeReason | null
    reasonComment?: NullableStringFieldUpdateOperationsInput | string | null
    changedById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SalaryHistoryUncheckedUpdateWithoutEmployeeInput = {
    id?: StringFieldUpdateOperationsInput | string
    previousGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    previousNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableEnumSalaryChangeReasonFieldUpdateOperationsInput | $Enums.SalaryChangeReason | null
    reasonComment?: NullableStringFieldUpdateOperationsInput | string | null
    changedById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SalaryHistoryUncheckedUpdateManyWithoutEmployeeInput = {
    id?: StringFieldUpdateOperationsInput | string
    previousGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    newGrossSalary?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    previousNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    newNetSalary?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    grossRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    netRaisePercentage?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    effectiveDate?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableEnumSalaryChangeReasonFieldUpdateOperationsInput | $Enums.SalaryChangeReason | null
    reasonComment?: NullableStringFieldUpdateOperationsInput | string | null
    changedById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}