# async-builder

Chained functions. They work asynchronously, meaning, if `pizza().cheese().bake().eat()`, 
`bake()` won't be run before `cheese()` has fulfilled its promise (if any). And `eat()` won't be run before `bake()` is fulfilled, etc.

### Todo
- `append` documentation and type

### Example

```ts
let pizza = asyncBuilder(({resolve, reject}, id: string) => {
	let content = {
		id,
		tomato: 0,
		cheese: 0,
		pepperoni: 0,
		pineapple: 0,
		mushrooms: 0,
	}
	let hurry = 1
	let timeItTakes = (ms) => new Promise((resolve) => setTimeout(resolve, ms * hurry))
	return {
		__catch(error) {
			console.error(error)
		},
		__validator() {
			console.assert(hurry < 0.3, 'Aren\'t you going a little fast there?')
		},
		__build(reject) {
			console.log(`Pizza ${id} has been made`, content)
			return content
		},
		hurry() {
			hurry /= 1.5
		},
		async tomatoSauce() {
			await timeItTakes(1000)
			content['tomato']++
		},
		async cheese() {
			await timeItTakes(500)
			content['cheese']++
		},
		async pepperoni() {
			await timeItTakes(700)
			content['pepperoni']++
		},
		async pineapple() {
			throw new Error("Don't.")
		},
		async mushrooms() {
			await timeItTakes(100)
			content['mushrooms']++
		}
	}
})

async function makePizza() {
	let pizza = await pizza('1').tomatoSauce().cheese().pepperoni().mushrooms().cheese()
	let pizza = await pizza('2').hurry().hurry().hurry().hurry().cheese().cheese().pepperoni().cheese()
}

makePizza()
```

## Initial constructor
The constructor (i.e. `asyncBuilder(({resolve, reject}, ... any params) => {`), contains an object for `resolve` and `reject`.

| Name | Description
| ---- | -----------
| resolve | You can prematurely resolve which returns the content of `resolve(content)`. This stops any trailing functions from being run completely. <br><br> The true intention is to resolve by returning something in `__build()`, so use this with caution.
| reject | You can at any point reject the promise.<br>This also stops any trailing functions from being run completely. 

## Declarative returned functions
For readability, try to keep them in the following order

| Name | Description
| ---- | -----------
| `__init?` | The initial function to be called. <br>Used to initialize values that require asynchronous operatinos.<br><br>Like the other declared functions here, it will be called without chaining it.
| `__catch?` | The whole chain is inside a try-catch block. <br> If an error occurs, and __catch is defined, rather than throwing the error, __catch will be called.<br><br>Note: If __catch is not defined, reject(error), will be called before throwing an error.
| `__validator?` | Validator is called after every chained function. <br> And is therefore perhaps - good at continously doing validation and alike.
| `__build` | Is called as a last function to be called (before finally). This returns the awaited result of the builder-pattern.
| `__finally?` | No matter the given event of the chain function, finally will ALWAYS be run at the end
| `__function?` | This make the builder into a function. This is run before __init.

> <br>The `__function` is called like, pizza(1).cheese().pepperoni().cheddar()(...args)<br><br>
