type MaybePromise<T> = Promise<T> | T

interface Builder<T> {
	/** Is called as a final procedure. This returns the awaited result of the builder-pattern. */
	__build(): T

	/**
	 * (optional) Is called as the first (AFTER __function if it's included).
	 * Used to initialize values that require asynchronous operatinos.
	 * 
	 * It will be called automatically.
	 */
	__init?(): Promise<void> | void

	/**
	 * (optional) The whole chain is inside a try-catch block.
	 * If an error occurs, and __catch is defined, rather than throwing the error,
	 * __catch will be called.
	*/
	__catch?(error: any): Promise<void> | void

	/**
	 * (optional) No matter the given event of the chain function, finally will ALWAYS be run at the end.
	 * Throws error? Ends with finally.
	 * Fulfilled successfully? Ends with finally.
	 * Rejected? Ends with finally.
	 * Resolved prematurely? Ends with finally.
	*/
	__finally?(): Promise<void> | void

	/**
	 * (optional) Validator is called after every chained function. 
	 * And is therefore perhaps - good at continously doing validation and alike.
	 */
	__validator?(): Promise<void> | void

	/**
	 * (optional) This make turns the builder into a function. This is called before __init.
	 * 
	 * That means, it has to end with:
	 * `pizza().cheese().cheese().pepperoni()(...params)`
	 * 
	 * This is useful if you want to use the builder as a function. In SvelteKit, the backend looks like this:
	 * `export const post = (event) => {...}`
	 * 
	 * Using __function, you can turn the builder into a function:
	 * `export const post = pizza().cheese().cheese()`, where
	 * `__function(event) {...}` then will be called.
	*/
	__function?(...any: any[]): Promise<void> | void
}

// @ts-expect-error
type ExcludeKeys<T> = Omit<T, '__build' | '__init' | '__catch' | '__finally' | '__validator' | Symbol>
const IGNORED_KEYS = ['__build', '__init', '__catch', '__finally', '__validator']

// TODO: Simplify the types as much as possible. And figure out how to make ´append´ return correct type

type BuildingBlocks<T extends BuildingBlocks<any>> = {
	/** Chained function */
	[key: string]: (o: BlockOptions<T>, ...any) => void
}

interface BlockOptions<K extends BuildingBlocks<any>> {
	append: ExcludeKeys<BuildingBlocksVoided<any, K>>
}

type OmitFirstArg<F> = F extends (x: any, ...args: infer P) => infer R ? (...args: P) => R : never

type BuildingBlocksVoided<
	T extends MaybePromise<any>,
	K extends BuildingBlocks<K>
	> = {
		[P in keyof K]: (...any: Parameters<OmitFirstArg<K[P]>>) => ExcludeKeys<BuildingBlocksVoided<T, K>> & Promise<T>
	}

type InitOptions = {
	/** 
	 * You can at any point reject the promise.
	 * This stops any trailing functions from being run completely. 
	*/
	reject: (reason?: any) => void,

	/** 
	 * You can prematurely resolve which returns the content of `resolve(content)`.
	 * This stops any trailing functions from being run completely. 
	 * 
	 * The true intention is to resolve by returning something in `__build()`, so use this with caution. 
	*/
	resolve: (content) => void
}

/** @link https://gist.github.com/Refzlund/d19286d819781e2f6ab44af2f26ccfe5
 * 
 * As described below: (params) => returns 
 * 
 * @param promise `{ resolve, reject }`
 * 
 * `resolve`: You can prematurely resolve which returns the content of `resolve(content)`.
 * This stops any trailing functions from being run completely. 
 * 
 * The true intention is to resolve by returning something in `__build()`, so use this with caution. 
 * 
 * `reject`: You can at any point reject the promise.
 * This also stops any trailing functions from being run completely. 
 * 
 * @returns
 * `__build`: Is called as a final procedure. This returns the awaited result of the builder-pattern.
 * 
 * `__init?`: Is called as the very first function.
 * Used to initialize values that require asynchronous operatinos. 
 * 
 * `__catch?`: The whole chain is inside a try-catch block. 
 * If an error occurs, and __catch is defined, rather than throwing the error,
 * 
 * `__finally?`: No matter the given events of the chain function, finally will ALWAYS be run at the very end.
 * 
 * `__validator?`: Validator is called after every chained function.
 * 
 * `__function?`: This make turns the builder into a function. This is called before __init.
*/
export default function asyncBuilder
	<T extends Promise<unknown>, K extends BuildingBlocks<any>, P extends any[]>
	(handle: (p?: InitOptions, ...args: P) => K & Builder<T>):
	(...args: P) => BuildingBlocksVoided<T, K> & Promise<T> {
	// @ts-expect-error
	return (...args: P) => {
		// Create promise
		let resolver: (content) => void, rejecter: (reason?: any) => void
		let finalized = false
		const promise = new Promise((resolve, reject) => {
			resolver = (content) => {
				finalized = true
				resolve(content)
			}
			rejecter = (reason) => {
				finalized = true
				reject(reason)
			}
		})

		// Appended Functions
		type FunctionArray = (FunctionArray | (() => Promise<any>))[]
		let functions: FunctionArray = []
		let fnIndex = 0
		let fnArray = functions

		// Initialize builder
		const builder = handle({ reject: rejecter, resolve: resolver }, ...args)
		const isFunction = '__function' in builder
		const hasValidator = '__validator' in builder

		// The builder contents
		let returned = isFunction ? builder.__function : {}

		const __finally = () => {
			if ('__finally' in builder)
				builder.__finally()
		}

		function appender() {
			waitTick = true
			return proxy
		}

		for (const [key, val] of Object.entries(builder)) {
			if (IGNORED_KEYS.includes(key)) continue
			returned['__' + key] = (...args) => {
				// Building block option
				const func = () => val({
					append: <any>appender()
				}, ...args)

				if (waitTick) {
					if (typeof fnArray[fnIndex + 1] !== 'object')
						fnArray.splice(fnIndex + 1, 0, [])
					// @ts-expect-error
					fnArray[fnIndex + 1].push(func)
				}
				else // @ts-expect-error
					fnArray.push(func)
				return proxy
			}
		}

		const tick = new Promise(resolve => setTimeout(resolve, 0))
		let waitTick = false
		setTimeout(async () => {
			try {
				if ('__init' in builder)
					await builder.__init()

				async function runArray(arr: FunctionArray) {
					fnArray = arr
					for (let i = 0;i < arr.length;i++) {
						fnIndex = i
						let fn = fnArray[i]
						if (typeof fn === 'function') {
							await fn()
						}
						if (finalized) {
							__finally()
							return
						}
						if (Array.isArray(fn)) {
							await runArray(fn)
							fnArray = arr
						}
						if (waitTick) {
							await tick
							waitTick = false
						}
						if (hasValidator)
							await builder.__validator()
					}
				}
				await runArray(functions)

				let result = await builder.__build()
				resolver(result)
			} catch (error) {
				if ('__catch' in builder)
					builder.__catch(error)
				else {
					rejecter(error)
					throw error
				}
			}
			finally {
				__finally()
			}
		}, 0)

		let proxy = new Proxy(returned, {
			get(target, prop) {
				if (prop === 'then')
					return promise.then.bind(promise)
				if (prop === 'catch')
					return promise.catch.bind(promise)
				if (prop === 'finally')
					return promise.finally.bind(promise)
				if (typeof prop === 'symbol')
					return target[prop]
				return (...args) => target['__' + prop](...args)
			}
		})
		return proxy
	}
}