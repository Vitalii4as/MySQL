module.exports = (_, clean) => {
	const mapProperties = (jsonSchema, iteratee) => {
		return Object.entries(jsonSchema.properties).map(iteratee);
	};

	const isUniqueKey = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (!column.unique) {
			return false;
		} else {
			return true;
		}
	};

	const isInlineUnique = column => {
		return isUniqueKey(column) && _.isEmpty(column.uniqueKeyOptions);
	};	

	const isPrimaryKey = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (column.compositePrimaryKey) {
			return false;
		} else if (!column.primaryKey) {
			return false;
		} else {
			return true;
		}
	};

	const isInlinePrimaryKey = column => {
		return isPrimaryKey(column) && _.isEmpty(column.primaryKeyOptions);
	};
	
	const getOrder = order => {
		if (_.toLower(order) === 'asc') {
			return 'ASC';
		} else if (_.toLower(order) === 'desc') {
			return 'DESC';
		} else {
			return '';
		}
	};
	
	const hydrateUniqueOptions = (options, columnName, isActivated) =>
		clean({
			keyType: 'UNIQUE',
			name: options['constraintName'],
			columns: [
				{
					name: columnName,
					order: getOrder(options['order']),
					isActivated: isActivated,
				},
			],
			category: options['indexCategory'],
			ignore: options['indexIgnore'],
			comment: options['indexComment'],
			blockSize: options['indexBlockSize'],
		});
	
	const hydratePrimaryKeyOptions = (options, columnName, isActivated) =>
		clean({
			keyType: 'PRIMARY KEY',
			name: options['constraintName'],
			columns: [
				{
					name: columnName,
					order: getOrder(options['order']),
					isActivated: isActivated,
				},
			],
			category: options['indexCategory'],
			ignore: options['indexIgnore'],
			comment: options['indexComment'],
			blockSize: options['indexBlockSize'],
		});
	
	const findName = (keyId, properties) => {
		return Object.keys(properties).find(name => properties[name].GUID === keyId);
	};
	
	const checkIfActivated = (keyId, properties) => {
		return _.get(
			Object.values(properties).find(prop => prop.GUID === keyId),
			'isActivated',
			true,
		);
	};
	
	const getKeys = (keys, jsonSchema) => {
		return keys.map(key => {
			return {
				name: findName(key.keyId, jsonSchema.properties),
				order: {
					'descending': 'DESC',
					'ascending': 'ASC',
				}[key.type] || '',
				isActivated: checkIfActivated(key.keyId, jsonSchema.properties),
			};
		});
	};
	
	const getCompositePrimaryKeys = jsonSchema => {
		if (!Array.isArray(jsonSchema.primaryKey)) {
			return [];
		}
	
		return jsonSchema.primaryKey
			.filter(primaryKey => !_.isEmpty(primaryKey.compositePrimaryKey))
			.map(primaryKey => ({
				...hydratePrimaryKeyOptions(primaryKey),
				columns: getKeys(primaryKey.compositePrimaryKey, jsonSchema),
			}));
	};
	
	const getCompositeUniqueKeys = jsonSchema => {
		if (!Array.isArray(jsonSchema.uniqueKey)) {
			return [];
		}
	
		return jsonSchema.uniqueKey
			.filter(uniqueKey => !_.isEmpty(uniqueKey.compositeUniqueKey))
			.map(uniqueKey => ({
				...hydrateUniqueOptions(uniqueKey),
				columns: getKeys(uniqueKey.compositeUniqueKey, jsonSchema),
			}));
	};
	
	const getTableKeyConstraints = ({ jsonSchema }) => {
		if (!jsonSchema.properties) {
			return [];
		}

		const primaryKeyConstraints = mapProperties(jsonSchema, ([ name, schema ]) => {
			if (!isPrimaryKey(schema)) {
				return;
			} else if (_.isEmpty(schema.primaryKeyOptions)) {
				return;
			}

			return hydratePrimaryKeyOptions(schema.primaryKeyOptions, name, schema.isActivated);
		}).filter(Boolean);

		const uniqueKeyConstraints = _.flatten(mapProperties(jsonSchema, ([ name, schema ]) => {
			if (!isUniqueKey(schema)) {
				return [];
			} else if (_.isEmpty(schema.uniqueKeyOptions) || !Array.isArray(schema.uniqueKeyOptions)) {
				return [];
			}

			return schema.uniqueKeyOptions.map(uniqueKey => (
				hydrateUniqueOptions(uniqueKey, name, schema.isActivated)
			));
		})).filter(Boolean);
	
		return [
			...primaryKeyConstraints,
			...getCompositePrimaryKeys(jsonSchema),
			...uniqueKeyConstraints,
			...getCompositeUniqueKeys(jsonSchema),
		];
	};
	
	return {
		getTableKeyConstraints,
		isInlineUnique,
		isInlinePrimaryKey,
	};
};
