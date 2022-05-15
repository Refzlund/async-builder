import asyncBuilder from '.'

let pizza = asyncBuilder(() => {
	return {
		async __build() {
			console.log('---- build ----')
			return 'here'
		},
		test({ }, arg: string | number) {
			console.log('test', arg)
		},
		logger({ append }, cb) {

			cb && cb(append)
		}
	}
})

async function t() {
	let test =
		await pizza().test()
			.logger(c => c).test('a')
			.logger(append => append.test(1).logger(a => a.test('x')).test(2))
			.test('a').test('b')
			.logger(append => append.test(4).logger(a => a.test('z')).test(5))
			.test('d').test('e')

	console.log(test)
}
t()